#!/usr/bin/env node
/**
 * Local settings UI for the EC NDE views.
 *
 *   npm run settings            -> http://localhost:4300 (opens the browser)
 *   npm run settings -- 4400    -> another port
 *
 * A tiny HTTP server (no Express, no dependencies) that lets anyone with the
 * repo see and edit, through forms generated from config/schema.json:
 *   - config/global.json                 (all views)
 *   - config/views/<view>.json           (overrides per view; inherited values shown greyed)
 *   - data/return-labels.json            (return label addresses, all views)
 *   - views.config.json                  (the views: id, label, host) + add a view
 * and start a build for a view, streaming its output.
 *
 * SECURITY MODEL: none, on purpose. It binds to 127.0.0.1 only, is meant to be
 * run on a developer's machine, and writes to the working copy — git is the
 * review step. Never expose it on a network.
 *
 * Everything it writes goes through the same validation as the build
 * (scripts/config-generate.cjs), so the UI cannot save what the build would reject.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT, CONFIG_PATH, loadConfig, readActiveKey } = require('../view-context.cjs');
const { loadMergedConfig, validate, deepMerge, parseSettingsJs, SCHEMA_FILE, GLOBAL_FILE, VIEWS_DIR } = require('../config-generate.cjs');
const { readLanguages, applyLanguages } = require('../languages.cjs');
const { validateLibraries } = require('../return-labels.cjs');

const PORT = Number(process.argv[2]) || 4300;
const PUBLIC_DIR = path.join(__dirname, 'public');
const RETURN_LABELS_FILE = path.join(ROOT, 'data', 'return-labels.json');

// ------------------------------------------------------------------ helpers

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : null); } catch (e) { reject(new Error('Body is not valid JSON')); } });
    req.on('error', reject);
  });
}

/**
 * The part of `values` that differs from `base`: objects compared key by key,
 * arrays and scalars as a whole (the merge rule of global + view). Returns
 * undefined when nothing differs.
 */
/**
 * Drop keys the schema does not allow (additionalProperties: false), recursively.
 * Used on imported settings.js values: a file from an older package can still
 * carry settings that were removed since (e.g. printReturnLabel.labelPagePath,
 * codePaths, returnedMarker — hard-coded in the component since Oct 2026). Those
 * must not block the import; they are simply not written. Returns the dropped
 * dot paths so the UI can mention them.
 */
function pruneToSchema(node, s, root, at = '', dropped = []) {
  const r = resolveRef(s, root);
  if (!node || typeof node !== 'object' || Array.isArray(node) || !r || r.type !== 'object') return dropped;
  for (const k of Object.keys(node)) {
    const sub = r.properties?.[k];
    if (sub) pruneToSchema(node[k], sub, root, at ? `${at}.${k}` : k, dropped);
    else if (r.additionalProperties === false) { delete node[k]; dropped.push(at ? `${at}.${k}` : k); }
  }
  return dropped;
}
/**
 * Bring settings from an OLDER package into today's shape (in place), before
 * they are pruned and stored. Twin of migrateLegacySettings in
 * src/app/shared/runtime-settings.ts (Primo) and src/assets/editor/index.html
 * (package editor / maker) — keep the three in step.
 */
function migrateLegacySettings(values) {
  // Oct 2026 — one collection badge → a list of badges (libraryOnTheGo.badges).
  const lotg = values && values.libraryOnTheGo;
  if (lotg && typeof lotg === 'object' && !Array.isArray(lotg) && !('badges' in lotg) && 'collectionId' in lotg) {
    const badge = {};
    for (const k of ['collectionId', 'label', 'color', 'infoButtonLabel', 'dialogTitle', 'dialogHtml']) {
      if (k in lotg) badge[k] = lotg[k];
      delete lotg[k];
    }
    delete lotg.pnxEndpoint; // a constant in the module now (src/app/shared/record-doc.ts)
    lotg.badges = [badge];
  }

  // Oct 2026 — custom dialogs: `name` (plain word) became `selector` ("Opens from").
  const dialogs = values && values.customDialogs && values.customDialogs.dialogs;
  if (Array.isArray(dialogs)) {
    for (const d of dialogs) {
      if (!d || typeof d !== 'object' || !('name' in d)) continue;
      const name = String(d.name ?? '').trim();
      const sel = String(d.selector ?? '').trim();
      d.selector = name && sel ? `a[href="#${name}"], .${name}, ${sel}` : (sel || name);
      delete d.name;
    }
  }
  return values;
}

function resolveRef(s, root) {
  if (!s || !s.$ref) return s;
  const target = s.$ref.replace('#/', '').split('/').reduce((o, k) => o && o[k], root);
  return { ...resolveRef(target, root), ...s, $ref: undefined };
}

function diffFromBase(values, base) {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(values) && isObj(base)) {
    const out = {};
    for (const [k, v] of Object.entries(values)) {
      const d = diffFromBase(v, base[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return JSON.stringify(values) === JSON.stringify(base) ? undefined : values;
}

/** Everything the UI needs in one round trip. */
function bootstrap() {
  const schema = readJson(SCHEMA_FILE);
  const globalRaw = readJson(GLOBAL_FILE); delete globalRaw.$schema;
  const viewsConfig = loadConfig();
  const views = {};
  for (const key of Object.keys(viewsConfig.views)) {
    const file = path.join(VIEWS_DIR, `${key}.json`);
    const overrides = fs.existsSync(file) ? readJson(file) : {};
    delete overrides.$schema;
    views[key] = { overrides, merged: deepMerge(globalRaw, overrides), label: viewsConfig.views[key].label, viewId: viewsConfig.views[key].viewId };
  }
  const returnLabels = fs.existsSync(RETURN_LABELS_FILE) ? readJson(RETURN_LABELS_FILE) : {};
  return { schema, global: globalRaw, views, viewsConfig, returnLabels, languages: readLanguages(), root: ROOT };
}

/** Validate a candidate global (alone) AND merged with every view, so a global change cannot break a view. */
function validateGlobal(schema, candidate) {
  const errors = validate(schema, candidate).map((e) => `global: ${e}`);
  for (const key of Object.keys(loadConfig().views)) {
    const file = path.join(VIEWS_DIR, `${key}.json`);
    if (!fs.existsSync(file)) continue;
    const ov = readJson(file); delete ov.$schema;
    errors.push(...validate(schema, deepMerge(candidate, ov)).map((e) => `${key}: ${e}`));
  }
  return errors;
}

function validateReturnLabels(obj) {
  const errors = [];
  for (const [code, entry] of Object.entries(obj)) {
    if (code.startsWith('_')) continue;
    if (!/^[A-Z0-9_]+$/i.test(code)) errors.push(`${code}: code must be letters, digits or _`);
    if (!entry?.name) errors.push(`${code}: name is required`);
    if (entry?.returnAddress !== undefined) {
      if (!Array.isArray(entry.returnAddress) || !entry.returnAddress.length || !entry.returnAddress.every((l) => typeof l === 'string' && l.trim()))
        errors.push(`${code}: returnAddress must be one or more non-empty lines`);
    }
  }
  return errors;
}

/**
 * After a settings save, regenerate src/app/shared/ec-config.generated.ts for the
 * ACTIVE view (or the one just edited). Builds do this themselves via prebuild, but
 * a running `ng serve` only recompiles on file changes — without this step a saved
 * setting would not reach the dev server until the next restart.
 * Best-effort: a failure is reported in the response, never blocks the save.
 */
function regenerateConfig(preferredKey) {
  const key = preferredKey || readActiveKey() || Object.keys(loadConfig().views)[0];
  if (!key) return '';
  const r = spawnSync(process.execPath, ['scripts/config-generate.cjs', key], { cwd: ROOT, encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

// -------------------------------------------------------------------- routes

async function handleApi(req, res, url) {
  const schema = readJson(SCHEMA_FILE);
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const [, resource, key, sub] = parts;

  // GET /api/bootstrap
  if (req.method === 'GET' && resource === 'bootstrap') return send(res, 200, bootstrap());

  // PUT /api/global
  if (req.method === 'PUT' && resource === 'global') {
    const body = await readBody(req);
    const errors = validateGlobal(schema, body);
    if (errors.length) return send(res, 400, { errors });
    writeJson(GLOBAL_FILE, { $schema: './schema.json', ...body });
    return send(res, 200, { ok: true, output: regenerateConfig() });
  }

  // POST /api/views/<key>/import   body = { text: "<contents of a settings.js>" }
  // Takes a settings.js downloaded from a live package (settings editor) and makes
  // its values this view's settings in the repo: only values that differ from
  // global.json are written to config/views/<key>.json (same as the UI does).
  // Refuses a file made for another view (vid mismatch) unless body.force is true.
  if (req.method === 'POST' && resource === 'views' && key && sub === 'import') {
    const cfg = loadConfig();
    const view = cfg.views[key];
    if (!view) return send(res, 404, { errors: [`unknown view ${key}`] });
    const body = await readBody(req);
    let envelope;
    try { envelope = parseSettingsJs(String(body.text || '')); }
    catch (err) { return send(res, 400, { errors: [`Could not read the file: ${err.message}`] }); }
    const vid = `${cfg.instId}:${view.viewId}`;
    if (envelope.vid && envelope.vid !== vid && !body.force) {
      return send(res, 409, { errors: [`This settings.js is for ${envelope.vid}, not for ${vid}.`], vid: envelope.vid });
    }
    // Texts in a language this repo does not have (added in the package editor)
    // cannot be stored — the schema only allows the repo's languages. Drop them
    // and say so: add the language in the Languages tab, then import again.
    const repoLangs = require('../languages.cjs').readLanguages().map((l) => l.code);
    const foreign = new Set();
    (function strip(node) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const keys = Object.keys(node);
      if (keys.length && keys.includes('en') && keys.every((k) => /^[a-z]{2}$/.test(k))) {
        for (const k of keys) if (!repoLangs.includes(k)) { foreign.add(k); delete node[k]; }
        return;
      }
      Object.values(node).forEach(strip);
    })(envelope.values);
    // Older package: bring its settings into today's shape first (one collection
    // badge → list of badges, …), then leave out what the schema no longer has.
    migrateLegacySettings(envelope.values);
    const dropped = pruneToSchema(envelope.values, schema, schema);
    // Settings the file does NOT have (added after that package was built, e.g.
    // printReturnLabel.enabled) keep this view's current value — otherwise an
    // old file would silently reset them to the global default.
    envelope.values = deepMerge(loadMergedConfig(key), envelope.values);
    const globalRaw = readJson(GLOBAL_FILE); delete globalRaw.$schema;
    const overrides = diffFromBase(envelope.values, globalRaw) || {};
    // Keys the schema no longer knows (older package) are dropped, not written.
    for (const k of Object.keys(overrides)) if (!schema.properties?.[k]) delete overrides[k];
    const errors = validate(schema, deepMerge(globalRaw, overrides));
    if (errors.length) return send(res, 400, { errors: ['The imported values do not fit the current settings:', ...errors] });
    // Return addresses ("libraries", edited in the package editor): shared by all
    // views, so they go to data/return-labels.json — only when they differ, and
    // validated first. The file's _comment (and other _ keys) are kept.
    let librariesChanged = 0;
    if (envelope.libraries && typeof envelope.libraries === 'object') {
      let incoming;
      try { incoming = validateLibraries(envelope.libraries); }
      catch (err) { return send(res, 400, { errors: [`Return labels in the file: ${err.message}`] }); }
      const current = fs.existsSync(RETURN_LABELS_FILE) ? readJson(RETURN_LABELS_FILE) : {};
      const codes = new Set([...Object.keys(incoming), ...Object.keys(current).filter((c) => !c.startsWith('_'))]);
      for (const c of codes) if (JSON.stringify(incoming[c]) !== JSON.stringify(current[c])) librariesChanged++;
      if (librariesChanged) {
        const next = {};
        for (const [k, v] of Object.entries(current)) if (k.startsWith('_')) next[k] = v;
        Object.assign(next, incoming);
        writeJson(RETURN_LABELS_FILE, next);
        spawnSync(process.execPath, ['scripts/return-labels.cjs'], { cwd: ROOT, encoding: 'utf8' });
      }
    }
    writeJson(path.join(VIEWS_DIR, `${key}.json`), { $schema: '../schema.json', ...overrides });
    return send(res, 200, { ok: true, savedBy: envelope.savedBy, savedAt: envelope.savedAt, foreignLanguages: [...foreign],
      droppedSettings: dropped, librariesChanged, output: regenerateConfig(key) });
  }

  // PUT /api/views/<key>   body = overrides only
  if (req.method === 'PUT' && resource === 'views' && key && !sub) {
    if (!loadConfig().views[key]) return send(res, 404, { errors: [`unknown view ${key}`] });
    const body = await readBody(req);
    const globalRaw = readJson(GLOBAL_FILE); delete globalRaw.$schema;
    const errors = validate(schema, deepMerge(globalRaw, body));
    if (errors.length) return send(res, 400, { errors });
    writeJson(path.join(VIEWS_DIR, `${key}.json`), { $schema: '../schema.json', ...body });
    return send(res, 200, { ok: true, output: regenerateConfig(key) });
  }

  // POST /api/languages/plan   body = { languages: [{code, name}, …] } → what a save would change (nothing written)
  // PUT  /api/languages        same body → apply (schema, settings files, per-language HTML files)
  // See scripts/languages.cjs for exactly what is touched.
  if (resource === 'languages' && ((req.method === 'POST' && key === 'plan') || (req.method === 'PUT' && !key))) {
    const body = await readBody(req);
    const dryRun = req.method === 'POST';
    const result = applyLanguages(body.languages, { dryRun });
    if (result.errors.length) return send(res, 400, { errors: result.errors });
    // A real change also regenerates the TypeScript config (EC_LANGUAGES, schema-typed values).
    const output = result.lines.join('\n') + (dryRun ? '' : '\n' + regenerateConfig());
    return send(res, 200, { ok: true, removed: result.removed, added: result.added.map((l) => l.code), lines: result.lines, output });
  }

  // PUT /api/return-labels
  if (req.method === 'PUT' && resource === 'return-labels') {
    const body = await readBody(req);
    const errors = validateReturnLabels(body);
    if (errors.length) return send(res, 400, { errors });
    writeJson(RETURN_LABELS_FILE, body);
    // Keep the generated package file in step so a dev build without a full build picks it up.
    const r = spawnSync(process.execPath, ['scripts/return-labels.cjs'], { cwd: ROOT, encoding: 'utf8' });
    return send(res, r.status === 0 ? 200 : 500, { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') });
  }

  // PUT /api/views-config   body = { instId, defaultHost, views: {...} }  (esbuildBinary etc. preserved)
  if (req.method === 'PUT' && resource === 'views-config') {
    const body = await readBody(req);
    const current = readJson(CONFIG_PATH);
    const errors = [];
    if (!body.instId) errors.push('instId is required');
    for (const [k, v] of Object.entries(body.views || {})) {
      if (!/^[a-z][a-z0-9-]*$/.test(k)) errors.push(`${k}: key must be lowercase letters, digits, dashes`);
      if (!v.viewId) errors.push(`${k}: viewId is required`);
      if (!v.label) errors.push(`${k}: label is required`);
      if (v.host && !/^https:\/\/[^/\s]+$/.test(v.host)) errors.push(`${k}: host must be https://host (no path)`);
    }
    if (errors.length) return send(res, 400, { errors });
    // Views deleted in the UI: remove them COMPLETELY (folder, settings file,
    // build output, angular.json configurations) with the same script as
    // `npm run views:remove`. It needs the view still in views.config.json, so
    // it runs BEFORE the new config is written; it rewrites the config itself,
    // hence the re-read of `current` afterwards.
    let output = '';
    const removed = Object.keys(current.views || {}).filter((k) => !(k in (body.views || {})));
    for (const k of removed) {
      const rr = spawnSync(process.execPath, ['scripts/remove-view.cjs', k, '--yes'], { cwd: ROOT, encoding: 'utf8' });
      output += (rr.stdout || '') + (rr.stderr || '');
      if (rr.status !== 0) return send(res, 500, { errors: [`Removing view "${k}" failed — nothing else was saved.`], output });
    }
    const fresh = removed.length ? readJson(CONFIG_PATH) : current;
    writeJson(CONFIG_PATH, { ...fresh, instId: body.instId, defaultHost: body.defaultHost, views: body.views });
    // Scaffold new views + angular.json configurations (idempotent).
    const r = spawnSync(process.execPath, ['scripts/sync-views.cjs'], { cwd: ROOT, encoding: 'utf8' });
    // A new view also needs an (empty) config file so the UI can show it.
    for (const k of Object.keys(body.views)) {
      const f = path.join(VIEWS_DIR, `${k}.json`);
      if (!fs.existsSync(f)) writeJson(f, { $schema: '../schema.json' });
    }
    return send(res, r.status === 0 ? 200 : 500, { ok: r.status === 0, output: output + (r.stdout || '') + (r.stderr || '') });
  }

  // GET /api/build/<key>  → Server-Sent Events with the build output
  if (req.method === 'GET' && resource === 'build' && key) {
    if (!loadConfig().views[key]) return send(res, 404, { errors: [`unknown view ${key}`] });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const child = spawn(process.execPath, ['scripts/build.cjs', key], { cwd: ROOT, env: process.env });
    child.stdout.on('data', (d) => emit('log', d.toString()));
    child.stderr.on('data', (d) => emit('log', d.toString()));
    child.on('close', (code) => {
      const v = loadConfig().views[key];
      emit('done', { code, zip: path.join(ROOT, 'dist', `${loadConfig().instId}-${v.viewId}.zip`) });
      res.end();
    });
    req.on('close', () => child.kill());
    return;
  }

  send(res, 404, { errors: ['not found'] });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    // The WYSIWYG editor lives with the package editor (one implementation for both).
    if (url.pathname === '/rich-text.js') {
      const rte = path.join(ROOT, 'src', 'assets', 'editor', 'rich-text.js');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(rte));
    }
    const file = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (err) {
    send(res, 500, { errors: [err.message] });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}`;
  console.log(`Settings UI: ${addr}   (Ctrl+C to stop)`);
  // Open the browser; harmless if it fails.
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', addr]] : process.platform === 'darwin' ? ['open', [addr]] : ['xdg-open', [addr]];
  try { spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* ignore */ }
});
