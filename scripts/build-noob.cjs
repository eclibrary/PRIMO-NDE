#!/usr/bin/env node
/**
 * Build the NOOB ZIP — NOOB = "NDE Out Of the Box": our NDE customizations as a kit for libraries WITHOUT a
 * developer (no Node, npm or Git). Anyone, anywhere, with an Alma/Primo NDE view.
 *
 *   npm run build:noob            (same as: npm run build -- --noob)
 *   -> dist/ec-nde-noob-<version>.zip
 *
 * WHAT THE LIBRARY GETS (unzipped):
 *   ec-nde-noob-<version>/
 *     START HERE.html   the package maker: drop the package downloaded from Alma,
 *                       adjust the settings, click "Make package", upload the result
 *     COMMENCER ICI.html  the same page in French  } see UI_LANGUAGES below:
 *     EMPEZAR AQUI.html   the same page in Spanish } + maker/ui-<lang>.js
 *     README.txt        the same instructions as plain text
 *     LISEZ-MOI.txt     README in French  (src/noob/i18n/README.fr.txt)
 *     LEAME.txt         README in Spanish (src/noob/i18n/README.es.txt)
 *     examples/         example files for the library's OWN package files, e.g.
 *                       homepage_en.html using guest/user, network, loans due,
 *                       account counts and "pick up where you left off"
 *                       (src/noob/examples, copied as they are), plus
 *       FOR-CLAUDE.md   a knowledge file for a Claude project: instructions for
 *                       Claude + README + every setting + the examples
 *                       (src/noob/FOR-CLAUDE.md, filled in by forClaude();
 *                       a copy also lands next to the kit zip in dist/)
 *     maker/            what START HERE.html needs (do not separate them):
 *       kit.js          version, settings schema, neutral defaults and OUR CODE
 *                       (the "core" files, base64) — a .js so the page can load it
 *                       from disk (file://), where reading other files is blocked
 *       zip.js          zip reader/writer (src/assets/editor/zip.js)
 *       rich-text.js    WYSIWYG for HTML messages (src/assets/editor/rich-text.js)
 *       markup-help.js  the "HTML features" tab (src/assets/editor/markup-help.js)
 *       ui-fr.js        interface texts in French / Spanish for COMMENCER ICI.html /
 *       ui-es.js        EMPEZAR AQUI.html (from src/noob/i18n/<lang>.json)
 *
 * WHAT GOES INTO THEIR PACKAGE ("core", replaced as a whole on every update):
 *   remoteEntry.js and the other compiled .js/.css files at the package root,
 *   assets/core/ec-core.css   our global styles (src/noob/core/theme.scss),
 *                             loaded by the module (src/app/shared/core-styles.ts)
 *   assets/core/version.js    marks the package as ours + which version
 * Everything else in their package (custom.css, homepage, header/footer, images,
 * assets/settings.js …) is THEIRS and is kept by the package maker.
 *
 * NOTHING EC-SPECIFIC: settings come from config/global.json + config/noob.json
 * (EC hosts, ids, URLs and wording blanked or switched off); the mappings
 * (src/noob/core/mappings.ts) leave out EC-only features (resource-sharing
 * format rule, internal-post return labels); no EC homepage/header/footer/
 * images/data. Check before sharing: the build fails if the core still
 * contains one of NO_EC_STRINGS below.
 *
 * VERSION = build date and time (e.g. 2026.10.15-1432): no manual bumping, and
 * the maker can tell "installed 2026.10.01-0910 → this kit 2026.10.15-1432".
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { quoteForShell, toolchainEnv, ROOT } = require('./view-context.cjs');
const { NOOB_KEY, NOOB_LANGUAGES, loadMergedConfig, SCHEMA_FILE } = require('./config-generate.cjs');

const ANGULAR_JSON = path.join(ROOT, 'angular.json');
const PROJECT = 'custom-module';
const BUILD_DIR = path.join(ROOT, 'dist', 'noob-build');   // raw ng build output (= the core)
const KIT_ROOT = path.join(ROOT, 'dist', 'noob');          // assembled kit folder(s)
const EDITOR_DIR = path.join(ROOT, 'src', 'assets', 'editor');
const README_TEMPLATE = path.join(ROOT, 'src', 'noob', 'README.txt');
const EXAMPLES_DIR = path.join(ROOT, 'src', 'noob', 'examples');
const FOR_CLAUDE_TEMPLATE = path.join(ROOT, 'src', 'noob', 'FOR-CLAUDE.md');
/**
 * Starter home page, header and footer (src/noob/starter/): the package maker
 * offers to ADD them to a package that has none of that kind ("Add starter
 * pages"); it never replaces a library's own. Kept in kit.js (KIT.starter) as
 * package path → text.
 */
const STARTER_DIR = path.join(ROOT, 'src', 'noob', 'starter');
const STARTER_FILES = {
  'assets/homepage/homepage_en.html': 'homepage_en.html',
  'assets/header-footer/header.html': 'header.html',
  'assets/header-footer/footer.html': 'footer.html',
};

/**
 * INTERFACE LANGUAGES OF THE PACKAGE MAKER (Oct 2026).
 *
 * The maker page exists once per language, side by side in the kit; each is
 * the same src/assets/editor/index.html, the translated ones with one extra
 * script, maker/ui-<code>.js:
 *     window.EC_UI = { lang, readme, strings: { "<English>": "<translation>" } }
 * The English text is the key (see "interface language" in index.html), so
 * the dictionaries src/noob/i18n/<code>.json are flat maps English → language.
 * They cover the page's own texts — t('…') / rich('…') in index.html,
 * t('…') in rich-text.js and zip.js — the schema's titles, help texts and
 * choice names (sections the kit shows), and the "HTML features" entries.
 *
 * Missing or outdated translations never break anything: the page shows the
 * English text, and the build prints the list (see reportTranslations). To
 * update a language: add the printed texts to src/noob/i18n/<code>.json.
 *
 * Page and README names have no accents on purpose (EMPEZAR AQUI, LEAME):
 * Windows' built-in unzip has mangled non-ASCII names in zips.
 * The visitor-facing default texts (settings values, starter and example
 * pages) are NOT part of this: libraries add those languages in the maker.
 */
const I18N_DIR = path.join(ROOT, 'src', 'noob', 'i18n');
const UI_LANGUAGES = [
  { code: 'en', name: 'English', page: 'START HERE.html', readme: 'README.txt' },
  { code: 'fr', name: 'Français', page: 'COMMENCER ICI.html', readme: 'LISEZ-MOI.txt' },
  { code: 'es', name: 'Español', page: 'EMPEZAR AQUI.html', readme: 'LEAME.txt' },
];
/** Files whose t('…') / rich('…') calls are interface texts (scanned by uiTexts). */
const UI_SOURCE_FILES = ['index.html', 'rich-text.js', 'zip.js'];

/** Schema sections hidden in the maker: their feature is not in the noob core. */
const HIDDEN_SECTIONS = ['printReturnLabel'];

/**
 * Strings that must not appear in the core (case-insensitive): EC hosts, our
 * institution code, EC-only ids. A hit fails the build, listing the files.
 * Code COMMENTS are stripped from the production bundle, so these only catch
 * real values that would reach another library.
 */
const NO_EC_STRINGS = ['32EUC_INST', 'ec.europa.eu', 'ec-europa', 'intragate', 'europa.eu/libraries', '8183322120004061'];

/**
 * The "noob" build configuration in angular.json. Written here (not by hand)
 * so it cannot drift; scripts/sync-views.cjs keeps it when it regenerates the
 * per-view configurations.
 */
function noobBuildConfiguration() {
  return {
    outputPath: 'dist/noob-build',
    fileReplacements: [
      { replace: 'src/app/custom1-module/customComponentMappings.ts', with: 'src/noob/core/mappings.ts' },
    ],
    // No assets: homepage, header/footer, images belong to the library. (Angular
    // still copies the default ones; main() deletes dist/noob-build/assets.)
    assets: [],
    styles: [
      'src/styles.scss',
      { input: 'src/noob/core/theme.scss', bundleName: 'custom', inject: false },
    ],
  };
}

/** Add/refresh the noob configuration; returns true when angular.json changed. */
function ensureAngularConfiguration() {
  const json = JSON.parse(fs.readFileSync(ANGULAR_JSON, 'utf8'));
  const cfgs = json.projects[PROJECT].architect.build.configurations;
  const want = noobBuildConfiguration();
  if (JSON.stringify(cfgs[NOOB_KEY]) === JSON.stringify(want)) return false;
  cfgs[NOOB_KEY] = want;
  fs.writeFileSync(ANGULAR_JSON, JSON.stringify(json, null, 2) + '\n');
  return true;
}

function run(cmd, args, env = {}) {
  const r = spawnSync(quoteForShell(cmd), args, {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...toolchainEnv(), ...env }, shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Every file under `dir`, as forward-slash paths relative to it. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** 2026.10.15-1432 (local time of the build machine). */
function versionStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * examples/FOR-CLAUDE.md: the template src/noob/FOR-CLAUDE.md with its
 * placeholders filled (see the comment at its top, which is left out here):
 * version, README, a reference of every setting (from the schema and the kit's
 * defaults — so it always matches this kit), and the example files.
 */
function forClaude(version, schema, defaults, readme) {
  const template = fs.readFileSync(FOR_CLAUDE_TEMPLATE, 'utf8').replace(/<!--[\s\S]*?-->\s*/, '');
  return template
    .split('{{VERSION}}').join(version)
    .split('{{README}}').join(readme.trim())
    .split('{{SETTINGS}}').join(settingsReference(schema, defaults))
    .split('{{MARKUP}}').join(markupReference())
    .replace(/\{\{EXAMPLE:([\w.-]+)\}\}/g, (_, f) => fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf8').trim());
}

/**
 * The "HTML features" (src/assets/editor/markup-help.js — the same list as the
 * editors' tab) as Markdown. The file is a browser script setting
 * window.EC_MARKUP_HELP; run it here with a stand-in window.
 */
function markupReference() {
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(EDITOR_DIR, 'markup-help.js'), 'utf8'))(sandbox.window);
  return (sandbox.window.EC_MARKUP_HELP || []).map((h) => [
    `### ${h.title}`,
    `*${h.needs ? `Needs the setting: ${h.needs}` : 'Works as soon as the kit is installed'}.* ${h.what}`,
    '```html', h.code, '```',
    ...(h.notes || []).map((n) => `- ${n}`),
  ].join('\n')).join('\n\n');
}

/**
 * Markdown list of the settings: per section its title, code name and help
 * text; per setting its title, code name, help text and default. Sections the
 * kit hides (HIDDEN_SECTIONS) are left out. Lists of items (banners, badges …)
 * describe the fields of one item. Translated texts show the English default.
 */
function settingsReference(schema, defaults) {
  const resolve = (s) => {
    if (!s || !s.$ref) return s || {};
    const target = s.$ref.replace('#/', '').split('/').reduce((o, k) => o && o[k], schema);
    const { $ref, ...own } = s;
    return { ...resolve(target), ...own };
  };
  const isText = (s) => s.type === 'object' && s.properties && 'en' in s.properties
    && Object.keys(s.properties).every((k) => /^[a-z]{2}$/.test(k));
  const short = (v) => {
    if (v === undefined) return '';
    let t = typeof v === 'string' ? v : JSON.stringify(v);
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length > 120) t = t.slice(0, 117) + '…';
    return t === '' ? '(empty)' : t.replace(/`/g, "'");
  };
  const line = (key, s, value, indent) => {
    const kind = isText(s) ? 'per language' : s.enum ? `one of: ${s.enum.map((e, i) => (s['x-enumNames']?.[i] ? `${e} (${s['x-enumNames'][i]})` : e)).join(', ')}` : s.type;
    const def = isText(s) ? short(value?.en) : short(value);
    const desc = (s.description || '').replace(/\s+/g, ' ').trim();
    // "x-showWhen": the field only appears in the form while siblings have these values.
    const when = s['x-showWhen'] && typeof s['x-showWhen'] === 'object'
      ? ` *(only shown when ${Object.entries(s['x-showWhen']).map(([k, v]) => `\`${k}\` = \`${v}\``).join(' and ')})*` : '';
    return `${indent}- **${s.title || key}** (\`${key}\`, ${kind})${desc ? ` — ${desc}` : ''}${def ? ` Default: \`${def}\`.` : ''}${when}${s['x-advanced'] ? ' *(advanced: shown with "Show advanced settings")*' : ''}`;
  };
  const fields = (s, value, indent) => {
    const out = [];
    for (const [k, sub] of Object.entries(s.properties || {})) {
      const r = resolve(sub);
      const v = value ? value[k] : undefined;
      if (r.type === 'object' && !isText(r) && r.properties) {
        out.push(`${indent}- **${r.title || k}** (\`${k}\`)${r.description ? ` — ${r.description.replace(/\s+/g, ' ')}` : ''}`);
        out.push(...fields(r, v, indent + '  '));
      } else if (r.type === 'array' && resolve(r.items).type === 'object') {
        const item = resolve(r.items);
        out.push(`${indent}- **${r.title || k}** (\`${k}\`, a list${Array.isArray(v) ? `; default: ${v.length} item${v.length === 1 ? '' : 's'}` : ''})${r.description ? ` — ${r.description.replace(/\s+/g, ' ')}` : ''} Each ${(item.title || 'item').toLowerCase()} has:`);
        out.push(...fields(item, undefined, indent + '  '));
      } else {
        out.push(line(k, r, v, indent));
      }
    }
    return out;
  };
  const parts = [];
  for (const [key, sub] of Object.entries(schema.properties || {})) {
    if (HIDDEN_SECTIONS.includes(key) || !(key in defaults)) continue;
    const s = resolve(sub);
    if (s.type !== 'object' || !s.properties) continue;
    parts.push(`### ${s.title || key} (\`${key}\`)${s['x-advanced'] ? ' — advanced' : ''}\n`);
    if (s.description) parts.push(`${s.description.replace(/\s+/g, ' ').trim()}\n`);
    parts.push(fields(s, defaults[key], '').join('\n') + '\n');
  }
  return parts.join('\n');
}

/**
 * Every English interface text the maker can show in the kit, as a Set:
 *   1. t('…') and rich('…') calls in UI_SOURCE_FILES (comments stripped first,
 *      so examples in comments do not count). Only single-quoted literals are
 *      found — the convention documented in index.html;
 *   2. the schema's title / description / x-patternHint / x-tabEmptyLabel /
 *      x-enumNames / x-choices labels, for the sections the kit shows (same
 *      keys as translateSchema() in index.html);
 *   3. the "HTML features" entries: title, what, needs, notes.
 */
function uiTexts(schema, defaults) {
  const out = new Set();
  // 1. Page texts.
  const literal = /\b(?:t|rich)\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const f of UI_SOURCE_FILES) {
    const src = fs.readFileSync(path.join(EDITOR_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(literal)) out.add(m[1].replace(/\\(.)/g, '$1'));
  }
  // 2. Schema texts ($refs followed; each node once).
  const seen = new Set();
  const walk = (s) => {
    if (!s || typeof s !== 'object' || seen.has(s)) return;
    seen.add(s);
    if (Array.isArray(s)) { s.forEach(walk); return; }
    for (const k of ['title', 'description', 'x-patternHint', 'x-tabEmptyLabel']) if (typeof s[k] === 'string' && s[k]) out.add(s[k]);
    (s['x-enumNames'] || []).forEach((n) => { if (typeof n === 'string' && n) out.add(n); });
    (s['x-choices'] || []).forEach((c) => { if (c && c.label) out.add(c.label); });
    for (const [k, v] of Object.entries(s)) {
      if (k === '$ref') walk(v.replace('#/', '').split('/').reduce((o, kk) => o && o[kk], schema));
      else if (k !== 'default' && k !== 'enum' && v && typeof v === 'object') walk(v);
    }
  };
  for (const [key, sub] of Object.entries(schema.properties || {})) {
    if (!HIDDEN_SECTIONS.includes(key) && key in defaults) walk(sub);
  }
  // 3. HTML features (markup-help.js is a browser script: run it with a stand-in window).
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(EDITOR_DIR, 'markup-help.js'), 'utf8'))(sandbox.window);
  for (const h of sandbox.window.EC_MARKUP_HELP || []) {
    for (const v of [h.title, h.what, h.needs, ...(h.notes || [])]) if (v) out.add(v);
  }
  return out;
}

/**
 * The dictionary of one language (src/noob/i18n/<code>.json), checked against
 * the texts the maker needs. Prints what is missing (shown in English until
 * translated) and what is no longer used (left over after an English text
 * changed — harmless, but worth cleaning). Returns only the entries in use.
 * A "$comment" key in the JSON is ignored.
 */
function reportTranslations(lang, needed) {
  const file = path.join(I18N_DIR, `${lang.code}.json`);
  const dict = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  delete dict.$comment;
  const missing = [...needed].filter((s) => !dict[s]);
  const unused = Object.keys(dict).filter((s) => !needed.has(s));
  const rel = path.relative(ROOT, file);
  if (missing.length) {
    console.warn(`[noob] ${lang.name}: ${missing.length} text(s) not translated yet — shown in English. Add them to ${rel}:`);
    for (const s of missing) console.warn(`         ${JSON.stringify(s)}`);
  } else console.log(`[noob] ${lang.name}: all ${needed.size} interface texts translated.`);
  if (unused.length) console.log(`[noob] ${lang.name}: ${unused.length} entr${unused.length === 1 ? 'y' : 'ies'} in ${rel} no longer used (English text changed or removed) — may be deleted.`);
  return Object.fromEntries(Object.entries(dict).filter(([s]) => needed.has(s)));
}

function zipFolder(folder, zipFile) {
  const archiver = require('archiver');
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(folder, path.basename(folder));
    archive.finalize();
  });
}

async function main() {
  const now = new Date();
  const version = versionStamp(now);
  console.log(`\n========== Building the noob zip, version ${version} ==========\n`);

  // 1. Compile the core: neutral settings (config-generate via prebuild.js with
  //    NDE_VIEW=noob), noob mappings and theme (angular.json "noob").
  if (ensureAngularConfiguration()) console.log('[noob] angular.json: "noob" build configuration added/updated');
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  run(process.execPath, ['prebuild.js'], { NDE_VIEW: NOOB_KEY });
  const ng = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'ng.cmd' : 'ng');
  run(ng, ['build', '--configuration', `production,${NOOB_KEY}`]);

  // 2. Shape the core as it will sit in a package.
  //    No assets at all: Angular copies the default "assets" option (src/assets:
  //    EC homepage, header/footer, images, data …) even with an empty list in the
  //    configuration, so the folder is removed here. Those files are the
  //    library's own; the core adds only assets/core/.
  fs.rmSync(path.join(BUILD_DIR, 'assets'), { recursive: true, force: true });
  //    custom.css (compiled theme) → assets/core/ec-core.css: custom.css is theirs.
  fs.mkdirSync(path.join(BUILD_DIR, 'assets', 'core'), { recursive: true });
  fs.renameSync(path.join(BUILD_DIR, 'custom.css'), path.join(BUILD_DIR, 'assets', 'core', 'ec-core.css'));
  // The shell's favicon is not ours to impose.
  fs.rmSync(path.join(BUILD_DIR, 'favicon.ico'), { force: true });
  fs.writeFileSync(path.join(BUILD_DIR, 'assets', 'core', 'version.js'),
    '/* Marks this customization package as containing the EC Library NDE kit (noob zip).\n' +
    '   Written by the build; the package maker reads it to recognise an installed version. Do not edit. */\n' +
    `window.EC_CORE_VERSION = ${JSON.stringify({ version, builtAt: now.toISOString() })};\n`);
  const coreFiles = listFiles(BUILD_DIR);

  // 3. Nothing EC-specific may ship.
  const hits = [];
  for (const f of coreFiles) {
    if (!/\.(js|css|html|txt)$/.test(f)) continue;
    const text = fs.readFileSync(path.join(BUILD_DIR, f), 'utf8').toLowerCase();
    for (const s of NO_EC_STRINGS) if (text.includes(s.toLowerCase())) hits.push(`${f}: "${s}"`);
  }
  if (hits.length) {
    console.error(`[noob] EC-specific values found in the core — not building the zip:\n  ${hits.join('\n  ')}`);
    process.exit(1);
  }

  // 4. Settings the maker starts from: the same neutral values the core was
  //    compiled with (English texts only), the schema (titles, help, types)
  //    and the languages (English only).
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const defaults = loadMergedConfig(NOOB_KEY);
  delete defaults.$schema;

  // 5. Assemble the kit folder.
  const name = `ec-nde-noob-${version}`;
  const kitDir = path.join(KIT_ROOT, name);
  fs.rmSync(KIT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(kitDir, 'maker'), { recursive: true });

  const kit = {
    version,
    builtAt: now.toISOString(),
    schema,
    // English only; the library adds its languages in the maker (see NOOB_LANGUAGES).
    languages: NOOB_LANGUAGES,
    // The maker page in each interface language (header links "English · Français · Español").
    uiLanguages: UI_LANGUAGES.map(({ code, name, page }) => ({ code, name, page })),
    defaults,
    hiddenSections: HIDDEN_SECTIONS,
    // Paths the maker REMOVES from a package before adding the core (old core,
    // or another custom module the library agreed to replace). Anything else
    // stays. Kept in the kit so a newer kit can widen the rule.
    coreRule: {
      // Files directly in the package folder:
      rootFiles: '^(remoteEntry\\.js|index\\.html|3rdpartylicenses\\.txt|[^/]+\\.js|(?!custom\\.css$)[^/]+\\.css)$',
      // Folders (everything inside):
      folders: ['assets/core/'],
    },
    // Starter pages, offered for packages without them (see STARTER_FILES).
    starter: Object.fromEntries(Object.entries(STARTER_FILES).map(([to, from]) => [to, fs.readFileSync(path.join(STARTER_DIR, from), 'utf8')])),
    // Our code, base64. Paths are relative to the package folder (<INST>-<VIEW>/).
    files: Object.fromEntries(coreFiles.map((f) => [f, fs.readFileSync(path.join(BUILD_DIR, f)).toString('base64')])),
  };
  fs.writeFileSync(path.join(kitDir, 'maker', 'kit.js'),
    `/* EC Library NDE kit ${version} — generated by scripts/build-noob.cjs. Do not edit.\n` +
    `   Loaded by "START HERE.html". Contains the settings schema, neutral defaults and the\n` +
    `   compiled code ("core") that the package maker puts into a customization package. */\n` +
    `window.EC_KIT = ${JSON.stringify(kit)};\n`);
  for (const f of ['zip.js', 'rich-text.js', 'markup-help.js']) fs.copyFileSync(path.join(EDITOR_DIR, f), path.join(kitDir, 'maker', f));

  // The maker is the settings editor in "maker" mode: same page, other scripts.
  // index.html marks its script block with <!-- ec:scripts --> … <!-- /ec:scripts -->.
  const editor = fs.readFileSync(path.join(EDITOR_DIR, 'index.html'), 'utf8');
  const block = /<!-- ec:scripts -->[\s\S]*?<!-- \/ec:scripts -->/;
  if (!block.test(editor)) throw new Error('src/assets/editor/index.html lost its <!-- ec:scripts --> markers');
  // One page per interface language (UI_LANGUAGES). The translated ones load
  // maker/ui-<code>.js BEFORE the other scripts, so rich-text.js and zip.js
  // see window.EC_UI too. <html lang> is set by the page itself (EC_UI.lang).
  const needed = uiTexts(schema, defaults);
  for (const lang of UI_LANGUAGES) {
    let uiScript = '';
    if (lang.code !== 'en') {
      const strings = reportTranslations(lang, needed);
      fs.writeFileSync(path.join(kitDir, 'maker', `ui-${lang.code}.js`),
        `/* EC Library NDE kit ${version} — interface texts in ${lang.name} for "${lang.page}".\n` +
        `   Generated by scripts/build-noob.cjs from src/noob/i18n/${lang.code}.json. Do not edit:\n` +
        `   change the JSON in the repository and build again. */\n` +
        `window.EC_UI = ${JSON.stringify({ lang: lang.code, readme: lang.readme, strings }, null, 1)};\n`);
      uiScript = `<script src="maker/ui-${lang.code}.js"></script>\n`;
    }
    fs.writeFileSync(path.join(kitDir, lang.page), editor.replace(block,
      `<!-- ec:scripts (noob kit, ${lang.name}) -->\n` +
      uiScript +
      '<script src="maker/kit.js"></script>\n' +
      '<script src="maker/zip.js"></script>\n' +
      '<script src="maker/rich-text.js"></script>\n' +
      '<script src="maker/markup-help.js"></script>\n' +
      '<!-- /ec:scripts -->'));
  }

  // Examples for the library's own files (home page …): src/noob/examples → examples/.
  // Copied as they are; they are documentation, not part of any package.
  fs.cpSync(EXAMPLES_DIR, path.join(kitDir, 'examples'), { recursive: true });

  const readme = fs.readFileSync(README_TEMPLATE, 'utf8').split('{{VERSION}}').join(version);
  // Windows line endings: the README is opened with Notepad by most recipients.
  fs.writeFileSync(path.join(kitDir, 'README.txt'), readme.replace(/\r?\n/g, '\r\n'));
  // Translated READMEs (src/noob/i18n/README.<code>.txt), same placeholders.
  // A missing one is skipped with a warning; the English README is always there.
  for (const lang of UI_LANGUAGES.filter((l) => l.code !== 'en')) {
    const src = path.join(I18N_DIR, `README.${lang.code}.txt`);
    if (!fs.existsSync(src)) { console.warn(`[noob] ${path.relative(ROOT, src)} missing — no ${lang.readme} in the kit.`); continue; }
    // UTF-8 with BOM: Notepad on older Windows versions otherwise guesses the
    // encoding wrongly and shows "Ã©" instead of "é".
    const text = fs.readFileSync(src, 'utf8').replace(/^﻿/, '').split('{{VERSION}}').join(version);
    fs.writeFileSync(path.join(kitDir, lang.readme), '﻿' + text.replace(/\r?\n/g, '\r\n'));
  }

  // Knowledge file for a Claude project (see forClaude): in the kit, and a
  // copy next to the kit zip so it can be shared on its own.
  const claudeDoc = forClaude(version, schema, defaults, readme);
  // Same rule as for the core: nothing EC-specific may ship (schema help texts
  // end up in this file too).
  const ecHit = NO_EC_STRINGS.find((w) => claudeDoc.includes(w));
  if (ecHit) throw new Error(`FOR-CLAUDE.md contains "${ecHit}" — remove it from config/schema.json, src/noob/ or the examples`);
  fs.writeFileSync(path.join(kitDir, 'examples', 'FOR-CLAUDE.md'), claudeDoc);

  // 6. Zip.
  const zipFile = path.join(ROOT, 'dist', `${name}.zip`);
  for (const f of fs.readdirSync(path.join(ROOT, 'dist'))) {
    if (/^ec-nde-noob-.*(\.zip|-FOR-CLAUDE\.md)$/.test(f)) fs.rmSync(path.join(ROOT, 'dist', f)); // keep only the newest
  }
  fs.writeFileSync(path.join(ROOT, 'dist', `${name}-FOR-CLAUDE.md`), claudeDoc);
  await zipFolder(kitDir, zipFile);
  const kb = Math.round(fs.statSync(zipFile).size / 1024);
  console.log(`\n[noob] ${coreFiles.length} core files, version ${version}`);
  console.log(`[noob] Zip file created at: ${path.relative(ROOT, zipFile)} (${kb} KB) — ready to share.`);
  console.log(`[noob] Claude knowledge file: examples/FOR-CLAUDE.md in the kit, copy at dist/${name}-FOR-CLAUDE.md`);
}

module.exports = { noobBuildConfiguration, NOOB_KEY, uiTexts, UI_LANGUAGES };

if (require.main === module) {
  main().catch((err) => { console.error(`[noob] ${err.message}`); process.exit(1); });
}
