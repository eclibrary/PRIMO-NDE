#!/usr/bin/env node
/**
 * Generate src/app/shared/ec-config.generated.ts from the JSON settings.
 *
 *   node scripts/config-generate.cjs            -> for the active view (NDE_VIEW / .active-view)
 *   node scripts/config-generate.cjs finder     -> for one view
 *   node scripts/config-generate.cjs --global   -> global.json only (plain `ng build`)
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
const OUT_FILE = path.join(ROOT, 'src', 'app', 'shared', 'ec-config.generated.ts');

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
 * properties, additionalProperties, items, minimum, $ref (#/definitions/…).
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
  const file = path.join(VIEWS_DIR, `${viewKey}.json`);
  return fs.existsSync(file) ? deepMerge(global, readJson(file)) : global;
}

// --------------------------------------------------------------------- main

function main() {
  const arg = process.argv[2];
  let viewKey = null;
  if (arg && arg !== '--global') viewKey = arg;
  else if (!arg) viewKey = readActiveKey();

  if (viewKey && !loadConfig().views[viewKey]) {
    console.error(`[config] unknown view "${viewKey}" (see views.config.json)`);
    process.exit(1);
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const merged = loadMergedConfig(viewKey);
  const errors = validate(schema, merged);
  if (errors.length) {
    console.error(`[config] ${errors.length} problem(s) in config/${viewKey ? `views/${viewKey}.json (merged with global.json)` : 'global.json'}:`);
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
    `export const EC_CONFIG_VALUES: EcConfigValues = ${JSON.stringify(merged, null, 2)};\n`;

  fs.writeFileSync(OUT_FILE, banner);
  console.log(`[config] wrote ${path.relative(ROOT, OUT_FILE)} for ${viewKey ?? 'global'}`);
}

module.exports = { loadMergedConfig, validate, deepMerge, CONFIG_DIR, SCHEMA_FILE, GLOBAL_FILE, VIEWS_DIR };

if (require.main === module) main();
