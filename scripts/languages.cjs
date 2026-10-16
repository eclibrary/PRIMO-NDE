#!/usr/bin/env node
/**
 * UI languages of the views — add / remove / list.
 *
 *   npm run languages                       -> list the languages
 *   npm run languages -- add it "Italiano"  -> add Italian
 *   npm run languages -- remove it          -> remove Italian (asks first)
 *   … add --yes to skip the question, --dry-run to only show what would change.
 *
 * The settings UI (Languages tab) uses the same functions (module exports below).
 *
 * SINGLE SOURCE OF TRUTH: config/languages.json
 *     { "languages": [ { "code": "en", "name": "English" }, { "code": "fr", "name": "Français" }, … ] }
 * The list applies to ALL views (a view without its own homepage_xx.html simply
 * gets NDE's fallback to English). English is always first and cannot be
 * removed: it is the fallback for every text (`Localised` requires `en`).
 * Codes are two lowercase letters — the `lang=` value NDE puts in the URL.
 *
 * WHAT A CHANGE TOUCHES
 *   config/schema.json   every "per-language" object (an object schema whose
 *                        properties are exactly the languages, e.g. the
 *                        `localised` definition and the Ask-a-librarian line
 *                        labels) gets a property per language; the defaultLang
 *                        enum lists the codes. The settings UI reads its
 *                        language inputs from the schema, so new languages
 *                        appear there automatically.
 *   ADD:
 *     src/**\/homepage_<code>.html  created next to every homepage_en.html, as a
 *                                  copy of the English file marked "TODO: translate"
 *     src/assets/header-footer/header_<code>.html, footer_<code>.html
 *                                  created as copies of header.html / footer.html
 *     (existing files are never overwritten). Translations in the settings stay
 *     empty until filled in; empty = English is shown (`localised()` fallback).
 *   REMOVE:
 *     config/global.json, config/views/*.json   the language's translations are
 *                                  deleted from every per-language value
 *     defaultLang                  reset to "en" where it pointed to the language
 *     homepage_<code>.html, header_<code>.html, footer_<code>.html   deleted
 *   Generated at build time from the list: EC_LANGUAGES in
 *   src/app/shared/ec-config.generated.ts (see scripts/config-generate.cjs),
 *   which currentLang() uses to accept a `lang=` value.
 *
 * NOT TOUCHED — do these by hand:
 *   - Alma: the language must be enabled for the view (Discovery > Display
 *     Configuration > Languages / the view's Language settings), otherwise NDE
 *     never sends lang=<code>. NDE's own labels are translated in Alma too.
 *   - The return-label page (src/assets/return-label/label.js) has
 *     its own small text table; a language missing there shows English.
 *   - dist/ build output: rebuild after a change.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ROOT } = require('./view-context.cjs');

const CONFIG_DIR = path.join(ROOT, 'config');
const LANGUAGES_FILE = path.join(CONFIG_DIR, 'languages.json');
const SCHEMA_FILE = path.join(CONFIG_DIR, 'schema.json');
const GLOBAL_FILE = path.join(CONFIG_DIR, 'global.json');
const VIEWS_DIR = path.join(CONFIG_DIR, 'views');
const HEADER_FOOTER_DIR = path.join(ROOT, 'src', 'assets', 'header-footer');

const CODE_RE = /^[a-z]{2}$/;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ------------------------------------------------------------------ reading

/**
 * The language list. If config/languages.json does not exist yet (repos from
 * before Oct 2026) it is derived from the schema's `localised` definition, so
 * the first run needs no manual setup.
 */
function readLanguages() {
  if (fs.existsSync(LANGUAGES_FILE)) return readJson(LANGUAGES_FILE).languages;
  const codes = Object.keys(readJson(SCHEMA_FILE).definitions?.localised?.properties || { en: {} });
  const KNOWN = { en: 'English', fr: 'Français', de: 'Deutsch' };
  return codes.map((code) => ({ code, name: KNOWN[code] || code }));
}

function writeLanguages(list) {
  writeJson(LANGUAGES_FILE, {
    $comment: 'UI languages of all views. Edit with `npm run languages` or the settings UI (Languages tab), not by hand: a change also updates schema.json, the settings files and the per-language HTML files.',
    languages: list,
  });
}

/** Validate a candidate list; returns error strings. */
function validateList(list) {
  const errors = [];
  if (!Array.isArray(list) || list.length === 0) return ['The list of languages is empty.'];
  if (list[0]?.code !== 'en') errors.push('English (en) must be the first language — it is the fallback for every text.');
  const seen = new Set();
  for (const l of list) {
    if (!CODE_RE.test(l?.code || '')) errors.push(`"${l?.code}": a language code is two lowercase letters (e.g. it, es, nl).`);
    if (seen.has(l?.code)) errors.push(`"${l.code}" is listed twice.`);
    seen.add(l?.code);
    if (!String(l?.name || '').trim()) errors.push(`"${l?.code}": a name is required (e.g. Italiano).`);
  }
  return errors;
}

// ------------------------------------------------------- per-language objects

/** True when an object's keys are all language codes and include "en" — i.e. a per-language value/schema. */
function isPerLanguage(keys, langSet) {
  return keys.length > 0 && keys.includes('en') && keys.every((k) => langSet.has(k));
}

/**
 * Rewrite schema.json for `codes`. Every object schema whose `properties` are a
 * per-language set (by the OLD list) is rebuilt: kept languages keep their
 * entry, new ones get a copy of the English entry. `defaultLang.enum` = codes.
 */
function updateSchema(schema, oldCodes, codes) {
  const oldSet = new Set(oldCodes);
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        && isPerLanguage(Object.keys(node.properties), oldSet)) {
      const props = {};
      for (const c of codes) props[c] = node.properties[c] ?? JSON.parse(JSON.stringify(node.properties.en));
      node.properties = props;
    }
    for (const v of Object.values(node)) walk(v);
  })(schema);
  if (schema.properties?.defaultLang) schema.properties.defaultLang.enum = [...codes];
  return schema;
}

/**
 * Remove the languages in `removed` from every per-language VALUE in a settings
 * object (global.json or a view file), and reset defaultLang to "en" if it
 * pointed to one of them. Returns the number of translations removed.
 */
function stripLanguages(data, oldCodes, removed) {
  const oldSet = new Set(oldCodes);
  let count = 0;
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node) && isPerLanguage(Object.keys(node), oldSet)) {
      for (const c of removed) if (c in node) { delete node[c]; count++; }
      return; // per-language leaves hold strings (or label maps) — nothing deeper to strip
    }
    for (const v of Object.values(node)) walk(v);
  })(data);
  if (removed.includes(data.defaultLang)) { data.defaultLang = 'en'; count++; }
  return count;
}

// -------------------------------------------------------------- HTML files

/** Every homepage_en.html under src/ (dist/ and node_modules are not under src/). */
function englishHomepages() {
  const found = [];
  (function walk(dir) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name === 'homepage_en.html') found.push(p);
    }
  })(path.join(ROOT, 'src'));
  return found;
}

/** Files to create for a new language: [{ from, to }]; existing targets are skipped. */
function filesToCreate(code) {
  const pairs = englishHomepages().map((from) => ({ from, to: path.join(path.dirname(from), `homepage_${code}.html`) }));
  for (const base of ['header', 'footer']) {
    const from = path.join(HEADER_FOOTER_DIR, `${base}.html`); // header.html = the English/default one
    if (fs.existsSync(from)) pairs.push({ from, to: path.join(HEADER_FOOTER_DIR, `${base}_${code}.html`) });
  }
  return pairs.filter((p) => !fs.existsSync(p.to));
}

/** Files to delete for a removed language. */
function filesToDelete(code) {
  const names = new Set([`homepage_${code}.html`, `header_${code}.html`, `footer_${code}.html`]);
  const found = [];
  (function walk(dir) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (names.has(d.name)) found.push(p);
    }
  })(path.join(ROOT, 'src'));
  return found;
}

/**
 * Starter copy of an English file for language `code`: same markup, a
 * "TODO: translate" comment at the top, and <html lang="…"> set to the code.
 */
function starterCopy(from, code, name) {
  let html = fs.readFileSync(from, 'utf8');
  const note = `<!-- TODO: translate to ${name} (${code}). Copied from ${path.basename(from)} by \`npm run languages\`; until translated, visitors in ${name} see this English text. -->\n`;
  html = html.replace(/<html([^>]*)\blang="[^"]*"/i, `<html$1lang="${code}"`);
  return /^<!DOCTYPE[^>]*>\s*/i.test(html) ? html.replace(/^(<!DOCTYPE[^>]*>\s*)/i, `$1${note}`) : note + html;
}

// ------------------------------------------------------------------- apply

/**
 * Plan (and, unless dryRun, apply) the change from the current list to `next`.
 * Returns { errors, added, removed, lines } — `lines` is a human-readable log.
 */
function applyLanguages(next, { dryRun = false } = {}) {
  const errors = validateList(next);
  if (errors.length) return { errors, added: [], removed: [], lines: [] };

  const current = readLanguages();
  const oldCodes = current.map((l) => l.code);
  const codes = next.map((l) => l.code);
  const added = next.filter((l) => !oldCodes.includes(l.code));
  const removed = oldCodes.filter((c) => !codes.includes(c));
  const lines = [];

  // Files first (planned), so the log can list them.
  const creates = added.flatMap((l) => filesToCreate(l.code).map((p) => ({ ...p, lang: l })));
  const deletes = removed.flatMap((c) => filesToDelete(c));
  for (const l of added) lines.push(`+ language ${l.code} (${l.name})`);
  for (const c of removed) lines.push(`- language ${c} (${current.find((l) => l.code === c)?.name || c})`);
  for (const c of creates) lines.push(`  create ${rel(c.to)}  (copy of ${path.basename(c.from)}, to translate)`);
  for (const d of deletes) lines.push(`  delete ${rel(d)}`);

  // Settings files: count what would be stripped.
  // config/noob.json = the neutral defaults of the noob zip (scripts/build-noob.cjs);
  // its texts follow the same language list, or the noob build would fail validation.
  const NOOB_FILE = path.join(CONFIG_DIR, 'noob.json');
  const settingsFiles = [GLOBAL_FILE, ...(fs.existsSync(NOOB_FILE) ? [NOOB_FILE] : []), ...(fs.existsSync(VIEWS_DIR) ? fs.readdirSync(VIEWS_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(VIEWS_DIR, f)) : [])];
  const stripped = [];
  if (removed.length) {
    for (const f of settingsFiles) {
      const data = readJson(f);
      const n = stripLanguages(data, oldCodes, removed);
      if (n) { stripped.push({ file: f, data }); lines.push(`  remove ${n} translation(s) from ${rel(f)}`); }
    }
  }
  lines.push('  update config/schema.json and config/languages.json');
  if (dryRun) return { errors: [], added, removed, lines };

  // Apply. Order: schema + list first (everything else is derived from them).
  writeJson(SCHEMA_FILE, updateSchema(readJson(SCHEMA_FILE), oldCodes, codes));
  writeLanguages(next);
  for (const s of stripped) writeJson(s.file, s.data);
  for (const c of creates) fs.writeFileSync(c.to, starterCopy(c.from, c.lang.code, c.lang.name));
  for (const d of deletes) fs.rmSync(d, { force: true });
  return { errors: [], added, removed, lines };
}

// --------------------------------------------------------------------- CLI

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())); }));
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const [cmd, code, ...nameParts] = args.filter((a) => !a.startsWith('--'));
  const list = readLanguages();

  if (!cmd || cmd === 'list') {
    for (const l of list) console.log(`${l.code}  ${l.name}${l.code === 'en' ? '   (fallback, cannot be removed)' : ''}`);
    if (!fs.existsSync(LANGUAGES_FILE)) console.log('\n(config/languages.json does not exist yet; this list comes from schema.json and is written on the first change.)');
    return;
  }
  let next;
  if (cmd === 'add') {
    if (!code) return fail('Usage: npm run languages -- add <code> "<Name>"');
    next = [...list, { code, name: nameParts.join(' ').trim() }];
  } else if (cmd === 'remove') {
    if (!code) return fail('Usage: npm run languages -- remove <code>');
    if (code === 'en') return fail('English cannot be removed: it is the fallback for every text.');
    if (!list.some((l) => l.code === code)) return fail(`"${code}" is not a language of the views (${list.map((l) => l.code).join(', ')}).`);
    next = list.filter((l) => l.code !== code);
  } else {
    return fail(`Unknown command "${cmd}". Use list, add or remove.`);
  }

  const plan = applyLanguages(next, { dryRun: true });
  if (plan.errors.length) return fail(plan.errors.join('\n'));
  console.log(plan.lines.join('\n'));
  if (flags.has('--dry-run')) return console.log('\n--dry-run: nothing changed.');
  if (cmd === 'remove' && !flags.has('--yes') && !(await confirm(`\nThis deletes the ${code} translations and files listed above. Type "yes" to continue: `))) {
    return console.log('Aborted.');
  }
  applyLanguages(next);
  console.log('\nDone. Rebuild the views; for a new language also enable it in Alma for each view.');
}

function fail(msg) { console.error(msg); process.exitCode = 1; }

module.exports = { readLanguages, validateList, applyLanguages, LANGUAGES_FILE };

if (require.main === module) main();
