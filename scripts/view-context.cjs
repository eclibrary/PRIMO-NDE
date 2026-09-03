/**
 * Single source of truth for "which view am I building/serving right now".
 *
 * Resolution order for the active view key:
 *   1. process.env.NDE_VIEW
 *   2. the .active-view file at the repo root (written by `npm run use -- <view>`)
 *
 * Used by: scripts/build.cjs, scripts/serve.cjs, postbuild.js, webpack.config.js,
 * proxy/proxy-utils.mjs. CommonJS so both CJS and ESM callers can import it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'views.config.json');
const ACTIVE_FILE = path.join(ROOT, '.active-view');

function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!raw.instId || !raw.views || typeof raw.views !== 'object') {
    throw new Error('views.config.json must define "instId" and a "views" object');
  }
  return raw;
}

function viewKeys() {
  return Object.keys(loadConfig().views);
}

function readActiveKey() {
  if (process.env.NDE_VIEW) return process.env.NDE_VIEW.trim();
  if (fs.existsSync(ACTIVE_FILE)) return fs.readFileSync(ACTIVE_FILE, 'utf8').trim();
  return null;
}

function setActiveKey(key) {
  resolveView(key); // validates
  fs.writeFileSync(ACTIVE_FILE, key + '\n');
}

/**
 * @param {string|null} [key] view key; defaults to the active view
 * @returns {{key:string, host:string, url:string, instId:string, viewId:string, label:string, dir:string, srcDir:string, assetsDir:string, distName:string, distDir:string}}
 */
function resolveView(key) {
  const cfg = loadConfig();
  const k = key || readActiveKey();
  if (!k) {
    throw new Error(
      `No active view. Run "npm run use -- <view>" or set NDE_VIEW. Known views: ${Object.keys(cfg.views).join(', ')}`
    );
  }
  const v = cfg.views[k];
  if (!v) {
    throw new Error(`Unknown view "${k}". Known views: ${Object.keys(cfg.views).join(', ')}`);
  }
  const dir = v.dir || k;
  const srcDir = path.join(ROOT, 'src', 'views', dir);
  const distName = `${cfg.instId}-${v.viewId}`;
  const host = (v.host || cfg.defaultHost || '').replace(/\/+$/, '');
  return {
    key: k,
    host,
    url: host ? `${host}/nde/home?vid=${cfg.instId}:${v.viewId}` : '',
    instId: cfg.instId,
    viewId: v.viewId,
    label: v.label || k,
    dir,
    srcDir,
    assetsDir: path.join(srcDir, 'assets'),
    distName,
    distDir: path.join(ROOT, 'dist', distName),
  };
}

/**
 * Environment additions every node/npm/ng invocation from this repo should get.
 * Currently: ESBUILD_BINARY_PATH on Windows, from views.config.json > esbuildBinary.
 * EC workstations block executables under the user profile, so esbuild must run
 * from a whitelisted copy in Program Files; several versions are installed there
 * and Angular 18 needs exactly 0.23.0.
 */
function toolchainEnv() {
  const env = {};
  const bin = (loadConfig().esbuildBinary || {})[process.platform];
  if (bin) {
    if (fs.existsSync(bin)) env.ESBUILD_BINARY_PATH = bin;
    else console.warn(`[nde-views] esbuildBinary for ${process.platform} not found: ${bin} (leaving ESBUILD_BINARY_PATH as is)`);
  }
  return env;
}

/**
 * Windows needs `shell: true` to run .cmd shims (ng.cmd, npm.cmd), and the shell
 * splits unquoted paths on spaces ("C:\\Program Files\\nodejs\\node.exe",
 * "...\\PRIMO NDE\\REPO\\node_modules\\.bin\\ng.cmd"). Quote them.
 */
function quoteForShell(p) {
  return process.platform === 'win32' && /\s/.test(p) && !/^".*"$/.test(p) ? `"${p}"` : p;
}

module.exports = { toolchainEnv, quoteForShell, ROOT, CONFIG_PATH, ACTIVE_FILE, loadConfig, viewKeys, readActiveKey, setActiveKey, resolveView };
