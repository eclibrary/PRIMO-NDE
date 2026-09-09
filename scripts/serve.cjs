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
 *
 * Network: on the EC network, outbound HTTPS must go through the corporate proxy.
 * Put it in the git-ignored .env at the repo root, credentials included:
 *   HTTPS_PROXY=http://<user>:<password>@proxy-t2-bx.welcome.ec.europa.eu:8012
 * (URL-encode special characters in the password: @ -> %40, : -> %3A, # -> %23, % -> %25.)
 * proxy/proxy-utils.mjs picks the variable up and tunnels through it; you should see
 * "[proxy] Tunnelling through corporate proxy ..." at startup. Off the EC network
 * (home without VPN), comment the line out so requests go direct.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { quoteForShell, toolchainEnv, ROOT, resolveView, readActiveKey, viewKeys } = require('./view-context.cjs');

// [nde-views] Load .env into process.env. Nothing else in the repo reads that file, so
// without this the dev proxy only tunnels if HTTPS_PROXY happens to be exported in the
// shell. Must run BEFORE `env` is built below: `ng serve` — and proxy/proxy-utils.mjs
// running inside it — inherit this process's environment. Variables already set in the
// shell take precedence over .env (dotenv never overwrites), which is what we want.
require('dotenv').config({ path: path.join(ROOT, '.env') });

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
if (proxy) {
  console.log(`  target: ${v.host}`);
  // Tell the developer up front whether the corporate proxy will be used — the most
  // common cause of ETIMEDOUT on the EC network is this variable not being set.
  const corp = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  console.log(`  via:    ${corp ? corp.replace(/\/\/.*@/, '//***@') : 'direct (no HTTPS_PROXY set)'}`);
}
console.log('');
const ngArgs = ['serve', '--configuration', v.key];
if (proxy) ngArgs.push('--proxy-config', './proxy/proxy.conf.mjs');
run(ng, ngArgs);
