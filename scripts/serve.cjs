#!/usr/bin/env node
/**
 * Dev server for one view.
 *
 *   npm run start:proxy              -> active view, proxied against PROXY_TARGET (proxy/proxy.const.mjs)
 *   npm run start:proxy -- pubs      -> that view
 *   npm run start                    -> no proxy; use ?useLocalCustomPackage=true on the real NDE URL
 *
 * The proxy serves compiled output from dist/<INST_ID>-<VIEW_ID>, so a build for that
 * view is run first if the folder does not exist yet.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { quoteForShell, toolchainEnv, ROOT, resolveView, readActiveKey, viewKeys } = require('./view-context.cjs');

const args = process.argv.slice(2);
const proxy = args.includes('--proxy');
const key = args.find((a) => !a.startsWith('--')) || readActiveKey();
if (!key) {
  console.error(`No view given. Pass one of: ${viewKeys().join(', ')} — or run "npm run use -- <view>".`);
  process.exit(1);
}
const v = resolveView(key);
const env = { ...process.env, ...toolchainEnv(), NDE_VIEW: v.key };
const ng = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'ng.cmd' : 'ng');
const shell = process.platform === 'win32';

function run(cmd, cmdArgs) {
  const r = spawnSync(quoteForShell(cmd), cmdArgs, { cwd: ROOT, stdio: 'inherit', env, shell });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (proxy && !fs.existsSync(v.distDir)) {
  console.log(`dist/${v.distName} not found — running an initial build so the proxy can serve compiled files.`);
  run(process.execPath, ['scripts/build.cjs', v.key, '--dev']);
}

run(process.execPath, ['prebuild.js']);
console.log(`\nServing ${v.key} (${v.instId}:${v.viewId})`);
console.log(`  local:  http://localhost:4201/nde/home?vid=${v.instId}:${v.viewId}&lang=en`);
if (proxy) console.log(`  target: ${v.host}`);
console.log('');
const ngArgs = ['serve', '--configuration', v.key];
if (proxy) ngArgs.push('--proxy-config', './proxy/proxy.conf.mjs');
run(ng, ngArgs);
