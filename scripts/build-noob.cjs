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
 *     README.txt        the same instructions as plain text
 *     examples/         example files for the library's OWN package files, e.g.
 *                       homepage_en.html using guest/user, network, loans due,
 *                       account counts and "pick up where you left off"
 *                       (src/noob/examples, copied as they are)
 *     maker/            what START HERE.html needs (do not separate them):
 *       kit.js          version, settings schema, neutral defaults and OUR CODE
 *                       (the "core" files, base64) — a .js so the page can load it
 *                       from disk (file://), where reading other files is blocked
 *       zip.js          zip reader/writer (src/assets/editor/zip.js)
 *       rich-text.js    WYSIWYG for HTML messages (src/assets/editor/rich-text.js)
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
    // Our code, base64. Paths are relative to the package folder (<INST>-<VIEW>/).
    files: Object.fromEntries(coreFiles.map((f) => [f, fs.readFileSync(path.join(BUILD_DIR, f)).toString('base64')])),
  };
  fs.writeFileSync(path.join(kitDir, 'maker', 'kit.js'),
    `/* EC Library NDE kit ${version} — generated by scripts/build-noob.cjs. Do not edit.\n` +
    `   Loaded by "START HERE.html". Contains the settings schema, neutral defaults and the\n` +
    `   compiled code ("core") that the package maker puts into a customization package. */\n` +
    `window.EC_KIT = ${JSON.stringify(kit)};\n`);
  for (const f of ['zip.js', 'rich-text.js']) fs.copyFileSync(path.join(EDITOR_DIR, f), path.join(kitDir, 'maker', f));

  // The maker is the settings editor in "maker" mode: same page, other scripts.
  // index.html marks its script block with <!-- ec:scripts --> … <!-- /ec:scripts -->.
  const editor = fs.readFileSync(path.join(EDITOR_DIR, 'index.html'), 'utf8');
  const block = /<!-- ec:scripts -->[\s\S]*?<!-- \/ec:scripts -->/;
  if (!block.test(editor)) throw new Error('src/assets/editor/index.html lost its <!-- ec:scripts --> markers');
  fs.writeFileSync(path.join(kitDir, 'START HERE.html'), editor.replace(block,
    '<!-- ec:scripts (noob kit) -->\n' +
    '<script src="maker/kit.js"></script>\n' +
    '<script src="maker/zip.js"></script>\n' +
    '<script src="maker/rich-text.js"></script>\n' +
    '<!-- /ec:scripts -->'));

  // Examples for the library's own files (home page …): src/noob/examples → examples/.
  // Copied as they are; they are documentation, not part of any package.
  fs.cpSync(EXAMPLES_DIR, path.join(kitDir, 'examples'), { recursive: true });

  const readme = fs.readFileSync(README_TEMPLATE, 'utf8').split('{{VERSION}}').join(version);
  // Windows line endings: the README is opened with Notepad by most recipients.
  fs.writeFileSync(path.join(kitDir, 'README.txt'), readme.replace(/\r?\n/g, '\r\n'));

  // 6. Zip.
  const zipFile = path.join(ROOT, 'dist', `${name}.zip`);
  for (const f of fs.readdirSync(path.join(ROOT, 'dist'))) {
    if (/^ec-nde-noob-.*\.zip$/.test(f)) fs.rmSync(path.join(ROOT, 'dist', f)); // keep only the newest
  }
  await zipFolder(kitDir, zipFile);
  const kb = Math.round(fs.statSync(zipFile).size / 1024);
  console.log(`\n[noob] ${coreFiles.length} core files, version ${version}`);
  console.log(`[noob] Zip file created at: ${path.relative(ROOT, zipFile)} (${kb} KB) — ready to share.`);
}

module.exports = { noobBuildConfiguration, NOOB_KEY };

if (require.main === module) {
  main().catch((err) => { console.error(`[noob] ${err.message}`); process.exit(1); });
}
