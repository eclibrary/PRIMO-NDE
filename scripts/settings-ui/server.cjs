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
 *   - data/return-labels.json            (Find-eR return labels)
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
const { loadMergedConfig, validate, deepMerge, SCHEMA_FILE, GLOBAL_FILE, VIEWS_DIR } = require('../config-generate.cjs');

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
  return { schema, global: globalRaw, views, viewsConfig, returnLabels, root: ROOT };
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
    writeJson(CONFIG_PATH, { ...current, instId: body.instId, defaultHost: body.defaultHost, views: body.views });
    // Scaffold new views + angular.json configurations (idempotent).
    const r = spawnSync(process.execPath, ['scripts/sync-views.cjs'], { cwd: ROOT, encoding: 'utf8' });
    // A new view also needs an (empty) config file so the UI can show it.
    for (const k of Object.keys(body.views)) {
      const f = path.join(VIEWS_DIR, `${k}.json`);
      if (!fs.existsSync(f)) writeJson(f, { $schema: '../schema.json' });
    }
    return send(res, r.status === 0 ? 200 : 500, { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') });
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
