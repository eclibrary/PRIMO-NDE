#!/usr/bin/env node
/**
 * Build one, several, or all views.
 *
 *   npm run build                 -> active view (.active-view / NDE_VIEW)
 *   npm run build -- finder       -> one view
 *   npm run build -- finder pubs  -> several
 *   npm run build -- --all        -> every view in views.config.json
 *   add --dev for an unoptimized build with source maps
 *
 * Each view: prebuild.js -> ng build --configuration production,<view> -> postbuild.js
 * Output: dist/<INST_ID>-<VIEW_ID>/ and dist/<INST_ID>-<VIEW_ID>.zip
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { quoteForShell, toolchainEnv, ROOT, viewKeys, resolveView, readActiveKey } = require('./view-context.cjs');

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const all = args.includes('--all');
const requested = args.filter((a) => !a.startsWith('--'));

let keys;
if (all) keys = viewKeys();
else if (requested.length) keys = requested;
else keys = [readActiveKey()].filter(Boolean);

if (!keys.length) {
  console.error(`Nothing to build. Pass a view (${viewKeys().join(', ')}), --all, or run "npm run use -- <view>".`);
  process.exit(1);
}

const ng = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'ng.cmd' : 'ng');

function run(cmd, cmdArgs, env) {
  const r = spawnSync(quoteForShell(cmd), cmdArgs, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...toolchainEnv(), ...env }, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Regenerate src/assets/data/libraries.js from data/return-labels.json so the package
// never ships stale return-label data. Fails the build on malformed data — better
// here than as a blank label for a patron.
run(process.execPath, ['scripts/return-labels.cjs']);

for (const key of keys) {
  const v = resolveView(key);
  const env = { NDE_VIEW: v.key };
  console.log(`\n========== Building ${v.key}  (${v.instId}:${v.viewId} — ${v.label}) ==========\n`);
  run(process.execPath, ['prebuild.js'], env);
  run(ng, ['build', '--configuration', `${dev ? 'development' : 'production'},${v.key}`], env);
  run(process.execPath, ['postbuild.js'], env);
}

console.log(`\nBuilt: ${keys.map((k) => resolveView(k).distName + '.zip').join(', ')}`);
