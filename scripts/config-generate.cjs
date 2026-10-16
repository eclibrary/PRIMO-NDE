#!/usr/bin/env node
/**
 * Generate src/app/shared/ec-config.generated.ts from the JSON settings.
 *
 *   node scripts/config-generate.cjs            -> for the active view (NDE_VIEW / .active-view)
 *   node scripts/config-generate.cjs finder     -> for one view
 *   node scripts/config-generate.cjs --global   -> global.json only (plain `ng build`)
 *   node scripts/config-generate.cjs noob       -> global.json + config/noob.json, the
 *                                                  neutral defaults of the noob zip
 *                                                  (scripts/build-noob.cjs). No settings.js:
 *                                                  the noob zip's package maker writes it.
 *
 * Called automatically by prebuild.js, i.e. before every build/serve, so the
 * TypeScript the bundle sees always matches config/*.json.
 *
 * SOURCE OF TRUTH
 *   config/schema.json          what exists, types, help text
 *   config/global.json          values for every view
 *   config/views/<view>.json    overrides for one view (any subset of the same keys)
 *
 * MERGE RULE: deep-merge — objects merge key by key, arrays and scalars in the
 * view file REPLACE the global value. A key absent from both stays absent.
 *
 * VALIDATION: the merged result is checked against the schema (types, enums,
 * required, unknown keys). A failure stops the build; a bad URL is far cheaper
 * to catch here than as a blank widget for a patron.
 *
 * Also exported (loadMergedConfig, validate) for the settings UI, which edits
 * the same files and wants the same rules.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, loadConfig, readActiveKey } = require('./view-context.cjs');

const CONFIG_DIR = path.join(ROOT, 'config');
const SCHEMA_FILE = path.join(CONFIG_DIR, 'schema.json');
const GLOBAL_FILE = path.join(CONFIG_DIR, 'global.json');
const VIEWS_DIR = path.join(CONFIG_DIR, 'views');
/**
 * Neutral defaults for the noob zip — anything EC-specific (hosts, ids, URLs,
 * EC wording) blanked or switched off, over global.json. Reserved key "noob":
 * it is not a view in views.config.json and never gets a view file.
 */
const NOOB_FILE = path.join(CONFIG_DIR, 'noob.json');
const NOOB_KEY = 'noob';
/**
 * The noob zip starts in ENGLISH ONLY: other libraries add their own languages
 * in the package maker (Languages section). Our fr/de texts are therefore
 * stripped from its defaults (onlyLanguages below) and its compiled language
 * list is just English.
 */
const NOOB_LANGUAGES = [{ code: 'en', name: 'English' }];

/**
 * Copy of `value` where every translated text map (an object whose keys are
 * all two-letter codes, "en" among them) keeps only the languages in `codes`.
 */
function onlyLanguages(value, codes) {
  if (Array.isArray(value)) return value.map((v) => onlyLanguages(v, codes));
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  const isText = keys.length > 0 && keys.includes('en') && keys.every((k) => /^[a-z]{2}$/.test(k));
  const out = {};
  for (const k of keys) {
    if (isText && !codes.includes(k)) continue;
    out[k] = isText ? value[k] : onlyLanguages(value[k], codes);
  }
  return out;
}
const OUT_FILE = path.join(ROOT, 'src', 'app', 'shared', 'ec-config.generated.ts');
// Runtime settings shipped IN the package (see src/app/shared/runtime-settings.ts):
//   assets/settings.js         this view's values — what the package reads when the page opens,
//                              and what the settings editor in the package edits
//   assets/editor/schema.js    the schema, for that editor (titles, descriptions, field types)
// Both are generated on every build (git-ignored). Alma rejects .json in packages, hence .js.
const SETTINGS_FILE = path.join(ROOT, 'src', 'assets', 'settings.js');
const EDITOR_SCHEMA_FILE = path.join(ROOT, 'src', 'assets', 'editor', 'schema.js');
/** Format version of settings.js — bump only when its envelope (not the values) changes. */
const SETTINGS_FORMAT = 1;

// ------------------------------------------------------------------ helpers

function readJson(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete raw.$schema; // editor hint only
  return raw;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: objects merge, everything else (arrays, scalars) is replaced by `over`. */
function deepMerge(base, over) {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

/**
 * Small JSON-Schema (draft-07 subset) validator: type, enum, required,
 * properties, additionalProperties, items, minimum, pattern, $ref (#/definitions/…).
 * Enough for our schema; avoids pulling in a validator dependency.
 * Returns a list of "path: message" strings (empty = valid).
 */
function validate(schema, value, root = schema, at = '$') {
  const errors = [];
  if (schema.$ref) {
    const ref = schema.$ref.replace('#/', '').split('/').reduce((o, k) => o?.[k], root);
    return validate(ref, value, root, at);
  }
  const type = schema.type;
  const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (type) {
    const ok = type === 'integer' ? Number.isInteger(value) : actual === type;
    if (!ok) return [`${at}: expected ${type}, got ${actual}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be ≥ ${schema.minimum}`);
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
  if (actual === 'object') {
    const props = schema.properties || {};
    for (const req of schema.required || []) if (!(req in value)) errors.push(`${at}.${req}: required`);
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) errors.push(...validate(props[k], v, root, `${at}.${k}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${k}: unknown key`);
      else if (isObject(schema.additionalProperties)) errors.push(...validate(schema.additionalProperties, v, root, `${at}.${k}`));
    }
  }
  if (actual === 'array' && schema.items) {
    value.forEach((item, i) => errors.push(...validate(schema.items, item, root, `${at}[${i}]`)));
  }
  return errors;
}

/** Global + one view's overrides, merged. viewKey null/'--global' = global only. */
function loadMergedConfig(viewKey) {
  const global = readJson(GLOBAL_FILE);
  if (!viewKey) return global;
  if (viewKey === NOOB_KEY) return onlyLanguages(deepMerge(global, readJson(NOOB_FILE)), NOOB_LANGUAGES.map((l) => l.code));
  const file = path.join(VIEWS_DIR, `${viewKey}.json`);
  return fs.existsSync(file) ? deepMerge(global, readJson(file)) : global;
}

// --------------------------------------------------------------------- main

/** Language list — lazy require: languages.cjs requires view-context.cjs too, keep load order simple. */
function readLanguages() {
  return require('./languages.cjs').readLanguages();
}

function main() {
  const arg = process.argv[2];
  let viewKey = null;
  if (arg && arg !== '--global') viewKey = arg;
  else if (!arg) viewKey = readActiveKey();

  if (viewKey && viewKey !== NOOB_KEY && !loadConfig().views[viewKey]) {
    console.error(`[config] unknown view "${viewKey}" (see views.config.json)`);
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const merged = loadMergedConfig(viewKey);
  const errors = validate(schema, merged);
  if (errors.length) {
    console.error(`[config] ${errors.length} problem(s) in config/${viewKey === NOOB_KEY ? 'noob.json (merged with global.json)' : viewKey ? `views/${viewKey}.json (merged with global.json)` : 'global.json'}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const banner =
    `// GENERATED by scripts/config-generate.cjs — DO NOT EDIT.\n` +
    `// Source: config/global.json${viewKey ? ` + config/views/${viewKey}.json` : ''} (schema: config/schema.json).\n` +
    `// Change the JSON (or use \`npm run settings\`) and rebuild; prebuild.js regenerates this file.\n` +
    `import type { EcConfigValues } from './ec-config';\n\n` +
    `/** View this bundle was generated for ('' = global only). */\n` +
    `export const EC_CONFIG_VIEW = ${JSON.stringify(viewKey ?? '')};\n\n` +
    `export const EC_CONFIG_VALUES: EcConfigValues = ${JSON.stringify(merged, null, 2)};\n\n` +
    `/** UI languages of the views (config/languages.json; first = English, the fallback). */\n` +
    `export const EC_LANGUAGES: readonly string[] = ${JSON.stringify((viewKey === NOOB_KEY ? NOOB_LANGUAGES : readLanguages()).map((l) => l.code))};\n`;

  fs.writeFileSync(OUT_FILE, banner);
  console.log(`[config] wrote ${path.relative(ROOT, OUT_FILE)} for ${viewKey ?? 'global'}`);

  // settings.js + editor schema — only for a real view build (a vid is needed).
  // The noob build skips this: scripts/build-noob.cjs puts schema and defaults
  // in the noob zip, and the package maker writes settings.js per institution.
  if (viewKey && viewKey !== NOOB_KEY) {
    const cfg = loadConfig();
    const v = cfg.views[viewKey];
    writeSettingsJs({
      format: SETTINGS_FORMAT,
      vid: `${cfg.instId}:${v.viewId}`,
      view: viewKey,
      label: v.label,
      savedAt: new Date().toISOString(),
      savedBy: 'build',
      // UI languages (config/languages.json). The settings editor can add or remove
      // languages here; the package then accepts them (runtime-settings.ts).
      languages: require('./languages.cjs').readLanguages(),
      values: merged,
      // Return addresses per Alma library code (data/return-labels.json), for the
      // "Print return label" page (assets/return-label/), which reads them from
      // this file. Outside "values" because they are data, not settings of the
      // custom module: runtime-settings.ts ignores them. Editable in the editor.
      libraries: require('./return-labels.cjs').readLibraries(),
    }, SETTINGS_FILE);
    fs.mkdirSync(path.dirname(EDITOR_SCHEMA_FILE), { recursive: true });
    fs.writeFileSync(EDITOR_SCHEMA_FILE,
      `/* GENERATED by scripts/config-generate.cjs — the settings schema, for the editor (index.html next to this file). */\n` +
      `window.EC_SCHEMA = ${JSON.stringify(schema, null, 2)};\n` +
      `/* UI languages (config/languages.json): code + display name, English first. */\n` +
      `window.EC_LANGUAGES = ${JSON.stringify(require('./languages.cjs').readLanguages())};\n`);
    console.log(`[config] wrote ${path.relative(ROOT, SETTINGS_FILE)} and ${path.relative(ROOT, EDITOR_SCHEMA_FILE)} for ${v.label} (${cfg.instId}:${v.viewId})`);
  }
}

/**
 * Write a settings.js file. The format is a JS assignment wrapping plain JSON:
 *     window.EC_SETTINGS = { "format": 1, "vid": "…", "values": { … } };
 * - .js because Alma refuses .json in customization packages;
 * - the editor loads it with a <script> tag (works from the package AND from an
 *   unzipped package on disk, file://);
 * - the custom module does NOT execute it: it fetches the text and JSON-parses the
 *   part between the first "{" and the last "}" (runtime-settings.ts), so a
 *   tampered file can never run code inside Primo.
 * The settings editor writes exactly the same format (assets/editor/index.html).
 */
function writeSettingsJs(envelope, file) {
  const header =
    `/*\n` +
    `  Settings of the ${envelope.label} view (${envelope.vid}).\n` +
    `  Read by the custom module every time a page opens; values here override the\n` +
    `  ones built into the package. To change them, use the settings editor in this\n` +
    `  package — assets/editor/index.html — then replace this file with the one it\n` +
    `  downloads and upload the package again. Do not edit by hand unless you know JSON.\n` +
    `  Saved by: ${envelope.savedBy}, ${envelope.savedAt}\n` +
    `*/\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${header}window.EC_SETTINGS = ${JSON.stringify(envelope, null, 2)};\n`);
}

/** Inverse of writeSettingsJs: the envelope object, or throws with a readable message. */
function parseSettingsJs(text) {
  const start = text.indexOf('{', text.indexOf('EC_SETTINGS'));
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('not a settings.js file (no "window.EC_SETTINGS = { … }" found)');
  const envelope = JSON.parse(text.slice(start, end + 1));
  if (!envelope || typeof envelope.values !== 'object') throw new Error('settings.js has no "values" section');
  return envelope;
}

module.exports = { NOOB_KEY, NOOB_FILE, NOOB_LANGUAGES, onlyLanguages, readLanguages, writeSettingsJs, parseSettingsJs, loadMergedConfig, validate, deepMerge, CONFIG_DIR, SCHEMA_FILE, GLOBAL_FILE, VIEWS_DIR };

if (require.main === module) main();
