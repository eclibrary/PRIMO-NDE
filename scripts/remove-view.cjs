#!/usr/bin/env node
/**
 * Remove a view from the monorepo — the inverse of `npm run views:add`.
 *
 *   npm run views:remove -- <key>            -> lists what will go, asks to confirm
 *   npm run views:remove -- <key> --yes      -> no prompt (CI / scripts)
 *   npm run views:remove -- <key> --dry-run  -> list only, change nothing
 *
 * What is scrubbed, in order:
 *   1. the entry in views.config.json               (single source of truth)
 *   2. src/views/<dir>/                             (mappings, theme, README, assets overlay, components)
 *   3. config/views/<key>.json                      (settings overrides)
 *   4. dist/<INST>-<VIEW_ID>/ and dist/<INST>-<VIEW_ID>.zip   (build output, if any)
 *   5. .active-view, if it pointed to this view     (so `npm run build` cannot pick a ghost)
 *   6. angular.json build/serve configurations      (via scripts/sync-views.cjs, which prunes
 *                                                    configurations for unknown keys)
 *
 * Deliberately NOT touched:
 *   - the view in Alma (delete it there if you mean it — this only forgets it here)
 *   - shared code in src/app/shared/ and src/assets/ (a view never owns those)
 *   - git history: the folder is deleted from the working tree; commit to make it stick
 *
 * Refuses to remove the last remaining view: the build tooling needs at least one.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { ROOT, CONFIG_PATH, ACTIVE_FILE, loadConfig, readActiveKey } = require('./view-context.cjs');

const args = process.argv.slice(2);
const key = args.find((a) => !a.startsWith('--'));
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');

function fail(msg) { console.error(msg); process.exit(1); }

/** Everything that would be removed, as { label, path, exists }. */
function plan(cfg, key) {
  const v = cfg.views[key];
  const dir = v.dir || key;
  const distBase = path.join(ROOT, 'dist', `${cfg.instId}-${v.viewId}`);
  const items = [
    { label: 'entry in views.config.json', path: CONFIG_PATH, exists: true, kind: 'entry' },
    { label: 'view folder', path: path.join(ROOT, 'src', 'views', dir), kind: 'dir' },
    { label: 'settings overrides', path: path.join(ROOT, 'config', 'views', `${key}.json`), kind: 'file' },
    { label: 'build output folder', path: distBase, kind: 'dir' },
    { label: 'build output zip', path: `${distBase}.zip`, kind: 'file' },
  ];
  for (const it of items) if (it.kind !== 'entry') it.exists = fs.existsSync(it.path);
  return { v, dir, items };
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())); }));
}

async function main() {
  const cfg = loadConfig();
  if (!key) fail(`Usage: npm run views:remove -- <key> [--yes] [--dry-run]\nKnown views: ${Object.keys(cfg.views).join(', ')}`);
  if (!cfg.views[key]) fail(`Unknown view "${key}". Known views: ${Object.keys(cfg.views).join(', ')}`);
  if (Object.keys(cfg.views).length === 1) fail(`"${key}" is the only view; the tooling needs at least one. Add another before removing it.`);

  const { v, items } = plan(cfg, key);
  const activeKey = readActiveKey();

  console.log(`\nRemoving view "${key}" (${cfg.instId}:${v.viewId} — ${v.label}). This will delete:`);
  for (const it of items) {
    const rel = path.relative(ROOT, it.path) || it.path;
    console.log(`  ${it.exists ? '✔' : '–'} ${it.label.padEnd(28)} ${rel}${it.exists ? '' : '   (not present)'}`);
  }
  if (activeKey === key) console.log(`  ✔ ${'.active-view'.padEnd(28)} currently points to this view → cleared`);
  console.log('  ✔ angular.json                 build/serve configurations for this key (pruned by views:sync)');
  console.log('\nNot touched: the view in Alma, shared code/assets, git history.');

  if (dryRun) { console.log('\n--dry-run: nothing changed.'); return; }
  if (!yes && !(await confirm(`\nType "yes" to remove "${key}": `))) { console.log('Aborted.'); return; }

  // 1. views.config.json — first, so a crash later still leaves the config consistent with sync.
  delete cfg.views[key];
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`\n  removed "${key}" from views.config.json`);

  // 2–4. files and folders
  for (const it of items) {
    if (it.kind === 'entry' || !it.exists) continue;
    fs.rmSync(it.path, { recursive: true, force: true });
    console.log(`  deleted ${path.relative(ROOT, it.path)}`);
  }

  // 5. active-view marker
  if (activeKey === key && fs.existsSync(ACTIVE_FILE)) {
    fs.rmSync(ACTIVE_FILE);
    console.log('  cleared .active-view (run "npm run use -- <view>" to pick another)');
  }

  // 6. angular.json via the existing sync (idempotent; prunes stale configurations).
  const r = spawnSync(process.execPath, ['scripts/sync-views.cjs'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) fail('views:sync failed — angular.json may still reference the removed view; run "npm run views:sync" and check.');

  console.log(`\nDone. Remaining views: ${Object.keys(cfg.views).join(', ')}.\nReview with "git status", then commit.`);
}

main().catch((err) => fail(err.message || String(err)));
