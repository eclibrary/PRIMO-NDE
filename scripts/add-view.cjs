#!/usr/bin/env node
/**
 * Add a new NDE view to the monorepo.
 *
 *   npm run views:add                       -> interactive: asks for each value
 *   npm run views:add -- --key pubs2 --view-id PUBS2 --label "Publications 2"
 *   npm run views:add -- ... --host https://other-inst.primo.exlibrisgroup.com
 *   npm run views:add -- ... --overlay      -> also copy homepage/header/footer into the view's assets/
 *   npm run views:add -- ... --use          -> make it the active view afterwards (npm run use)
 *
 * What it does, in order:
 *   1. validates the answers (key format, uniqueness of key / viewId / dir)
 *   2. appends the view to views.config.json (the single source of truth)
 *   3. runs scripts/sync-views.cjs, which scaffolds src/views/<dir>/{mappings.ts,theme.scss,README.md,assets/}
 *      and regenerates the per-view build/serve configurations in angular.json,
 *      then creates config/views/<key>.json (empty settings overrides)
 *   4. optionally (--overlay) copies the shared landing-page/header/footer HTML into the new
 *      view's assets/ so it starts with editable copies instead of inheriting the shared files
 *   5. prints the next steps (build, serve, Alma upload)
 *
 * Nothing is overwritten: an existing key/viewId/dir aborts before any file is touched, and
 * sync-views only ever creates missing files.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { ROOT, CONFIG_PATH, loadConfig } = require('./view-context.cjs');

// --------------------------------------------------------------------------- args

/** Parse `--name value` / `--flag` pairs into an object; positional args are ignored. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[name] = true;
    else { out[name] = next; i++; }
  }
  return out;
}

// -------------------------------------------------------------------- prompting

/** Minimal question helper on top of readline; `validate` returns an error string or null. */
function ask(rl, question, { def, validate } = {}) {
  const suffix = def !== undefined && def !== '' ? ` [${def}]` : '';
  return new Promise((resolve) => {
    const loop = () => {
      rl.question(`${question}${suffix}: `, (raw) => {
        const value = raw.trim() || (def ?? '');
        const err = validate ? validate(value) : null;
        if (err) { console.log(`  ${err}`); return loop(); }
        resolve(value);
      });
    };
    loop();
  });
}

// ------------------------------------------------------------------ validation

/** Keys are used as npm args, angular.json configuration names and folder names: keep them plain. */
const KEY_RE = /^[a-z][a-z0-9-]*$/;

function validators(cfg) {
  const keys = new Set(Object.keys(cfg.views));
  const viewIds = new Set(Object.values(cfg.views).map((v) => v.viewId));
  const dirs = new Set(Object.values(cfg.views).map((v) => v.dir || ''));
  return {
    key: (v) => (!KEY_RE.test(v) ? 'Use lowercase letters, digits and dashes, starting with a letter (e.g. "pubs2").'
      : keys.has(v) ? `"${v}" already exists in views.config.json.` : null),
    viewId: (v) => (!v ? 'The Alma view ID is required (the part after the colon in the vid, e.g. "VU2").'
      : viewIds.has(v) ? `View ID "${v}" is already used by another entry.` : null),
    label: (v) => (!v ? 'A label is required (shown in build/serve output).' : null),
    dir: (v) => (!KEY_RE.test(v) ? 'Folder name: lowercase letters, digits and dashes.'
      : dirs.has(v) ? `Folder "src/views/${v}" is already used by another entry.` : null),
    host: (v) => (v && !/^https:\/\/[^/\s]+$/.test(v) ? 'Host must look like https://xxx.primo.exlibrisgroup.com (no path).' : null),
  };
}

// ------------------------------------------------------------------------ main

async function main() {
  const cfg = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const check = validators(cfg);
  const interactive = !(args.key && args['view-id'] && args.label);

  console.log(`\nAdding a view to ${path.relative(ROOT, CONFIG_PATH)} (institution ${cfg.instId})`);
  console.log(`Existing: ${Object.keys(cfg.views).join(', ') || '(none)'}\n`);

  let answers;
  if (interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    answers = {};
    answers.key = await ask(rl, 'Short key (used in "npm run build -- <key>")', { def: args.key, validate: check.key });
    answers.viewId = await ask(rl, 'Alma view ID (vid = INST:VIEW_ID)', { def: args['view-id'], validate: check.viewId });
    answers.label = await ask(rl, 'Label', { def: args.label, validate: check.label });
    answers.dir = await ask(rl, 'Folder under src/views/', { def: args.dir || answers.key, validate: check.dir });
    answers.host = await ask(rl, 'Primo host (empty = defaultHost)', { def: args.host || '', validate: check.host });
    const overlay = await ask(rl, 'Copy shared homepage/header/footer into the view assets? (y/N)', { def: args.overlay ? 'y' : 'n' });
    answers.overlay = /^y/i.test(overlay);
    const use = await ask(rl, 'Make it the active view? (y/N)', { def: args.use ? 'y' : 'n' });
    answers.use = /^y/i.test(use);
    rl.close();
  } else {
    answers = {
      key: args.key, viewId: args['view-id'], label: args.label,
      dir: args.dir || args.key, host: args.host || '',
      overlay: !!args.overlay, use: !!args.use,
    };
    // Same validation as the interactive path — fail before touching anything.
    for (const [field, fn] of Object.entries(check)) {
      const err = fn(answers[field] ?? '');
      if (err) { console.error(`--${field === 'viewId' ? 'view-id' : field}: ${err}`); process.exit(1); }
    }
  }

  // 2. Write views.config.json. Only `host` is optional; omit it when empty so the
  //    entry stays identical in shape to the hand-written ones.
  const entry = { viewId: answers.viewId, label: answers.label, dir: answers.dir };
  if (answers.host) entry.host = answers.host;
  cfg.views[answers.key] = entry;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`\n  added "${answers.key}" to views.config.json`);

  // 3. Scaffold + angular.json via the existing, idempotent sync script.
  const sync = spawnSync(process.execPath, ['scripts/sync-views.cjs'], { cwd: ROOT, stdio: 'inherit' });
  if (sync.status !== 0) process.exit(sync.status ?? 1);

  // 3b. Settings overrides file, so the view shows up in `npm run settings` and
  //     prebuild finds a file to merge (an empty override set is valid).
  const settingsFile = path.join(ROOT, 'config', 'views', `${answers.key}.json`);
  if (!fs.existsSync(settingsFile)) {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({ $schema: '../schema.json' }, null, 2) + '\n');
    console.log(`  created config/views/${answers.key}.json`);
  }

  // 4. Optional overlay: give the view its own copies of the librarian-facing HTML.
  if (answers.overlay) {
    const viewAssets = path.join(ROOT, 'src', 'views', answers.dir, 'assets');
    const shared = path.join(ROOT, 'src', 'assets');
    const files = [
      ...listFiles(path.join(shared, 'homepage'), /^homepage(_[a-z]{2})?\.(html|css)$/),
      ...listFiles(path.join(shared, 'header-footer'), /^(header|footer)(_[a-z]{2})?\.html$/),
    ];
    for (const abs of files) {
      const rel = path.relative(shared, abs);
      const dest = path.join(viewAssets, rel);
      if (fs.existsSync(dest)) continue; // never overwrite
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
      console.log(`  copied assets/${rel.split(path.sep).join('/')} into the view overlay`);
    }
  }

  // 5. Optional: make it the active view for the plain `npm run build` / `npm run start`.
  if (answers.use) {
    const use = spawnSync(process.execPath, ['scripts/use-view.cjs', answers.key], { cwd: ROOT, stdio: 'inherit' });
    if (use.status !== 0) process.exit(use.status ?? 1);
  }

  const host = answers.host || cfg.defaultHost;
  console.log(`
Done. Next steps:
  1. Edit src/views/${answers.dir}/mappings.ts and theme.scss for anything view-specific.
  2. npm run build -- ${answers.key}          -> dist/${cfg.instId}-${answers.viewId}.zip
  3. npm run start:proxy -- ${answers.key}    -> http://localhost:4201/nde/home?vid=${cfg.instId}:${answers.viewId}&lang=en
  4. Alma: Discovery > Display Configuration > Configure Views > ${answers.viewId} > Manage Customization Package
     (and leave "Enable configuration" unchecked on the Landing Page tab to use assets/homepage/*.html)
  Live view: ${host}/nde/home?vid=${cfg.instId}:${answers.viewId}
`);
}

/** Files in `dir` whose basename matches `re` (non-recursive); [] when the dir is missing. */
function listFiles(dir, re) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f));
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
