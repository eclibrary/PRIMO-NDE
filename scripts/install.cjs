#!/usr/bin/env node
/**
 * `npm run setup` -- runs `npm ci` with the repo's toolchain environment applied
 * (ESBUILD_BINARY_PATH -> whitelisted esbuild 0.23.0 on EC Windows workstations).
 * Plain `npm ci` also works if that variable is already set correctly in your shell.
 */
const { spawnSync } = require('child_process');
const { ROOT, toolchainEnv, quoteForShell } = require('./view-context.cjs');

const env = { ...process.env, ...toolchainEnv() };
if (env.ESBUILD_BINARY_PATH) console.log(`ESBUILD_BINARY_PATH=${env.ESBUILD_BINARY_PATH}`);
const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', ...process.argv.slice(2)], {
  cwd: ROOT, stdio: 'inherit', env, shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
