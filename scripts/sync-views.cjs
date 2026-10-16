#!/usr/bin/env node
/**
 * Keeps the repo in sync with views.config.json:
 *   1. scaffolds src/views/<dir>/{mappings.ts,theme.scss,assets/,README.md} for any missing view
 *   2. regenerates the per-view "configurations" in angular.json (build + serve)
 *
 * Idempotent. Run after adding/renaming a view in views.config.json:
 *   npm run views:sync
 *
 * Existing view files are never overwritten; only missing ones are created.
 * The "production" and "development" configurations in angular.json are left untouched.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, loadConfig, resolveView } = require('./view-context.cjs');

const TEMPLATES = path.join(__dirname, 'templates');
const ANGULAR_JSON = path.join(ROOT, 'angular.json');
const PROJECT = 'custom-module';

function render(tmplName, vars) {
  let out = fs.readFileSync(path.join(TEMPLATES, tmplName), 'utf8');
  for (const [k, v] of Object.entries(vars)) out = out.split(`__${k}__`).join(v);
  return out;
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`  created ${path.relative(ROOT, file)}`);
  return true;
}

function scaffold(v) {
  const vars = { KEY: v.key, LABEL: v.label, INST_ID: v.instId, VIEW_ID: v.viewId, DIR: v.dir, URL: v.url };
  writeIfMissing(path.join(v.srcDir, 'mappings.ts'), render('mappings.ts.tmpl', vars));
  writeIfMissing(path.join(v.srcDir, 'theme.scss'), render('theme.scss.tmpl', vars));
  writeIfMissing(path.join(v.srcDir, 'README.md'), render('README.md.tmpl', vars));
  writeIfMissing(path.join(v.assetsDir, '.gitkeep'), '');
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function buildConfiguration(v) {
  return {
    fileReplacements: [
      {
        replace: 'src/app/custom1-module/customComponentMappings.ts',
        with: `${rel(v.srcDir)}/mappings.ts`,
      },
    ],
    // Arrays replace (not merge) the base options, so restate the full list.
    // Order matters: later entries overwrite earlier ones with the same output path.
    assets: [
      'src/favicon.ico',
      'src/assets',
      { glob: '**/*', input: rel(v.assetsDir), output: 'assets', ignore: ['.gitkeep'] },
    ],
    styles: [
      'src/styles.scss',
      { input: `${rel(v.srcDir)}/theme.scss`, bundleName: 'custom', inject: false },
    ],
  };
}

function serveConfiguration(v) {
  return { buildTarget: `${PROJECT}:build:development,${v.key}` };
}

function syncAngularJson(views) {
  const json = JSON.parse(fs.readFileSync(ANGULAR_JSON, 'utf8'));
  const arch = json.projects[PROJECT].architect;
  // "noob" = the build configuration of the noob zip (scripts/build-noob.cjs),
  // not a view: kept, and re-written from build-noob.cjs so it cannot drift.
  const keep = new Set(['production', 'development', 'noob']);

  for (const target of ['build', 'serve']) {
    const cfgs = arch[target].configurations || {};
    for (const k of Object.keys(cfgs)) if (!keep.has(k)) delete cfgs[k];
    if (target === 'build') cfgs.noob = require('./build-noob.cjs').noobBuildConfiguration();
    for (const v of views) cfgs[v.key] = target === 'build' ? buildConfiguration(v) : serveConfiguration(v);
    arch[target].configurations = cfgs;
  }
  fs.writeFileSync(ANGULAR_JSON, JSON.stringify(json, null, 2) + '\n');
  console.log(`  angular.json: configurations for [${views.map((v) => v.key).join(', ')}]`);
}

function main() {
  const cfg = loadConfig();
  const views = Object.keys(cfg.views).map((k) => resolveView(k));
  console.log(`Syncing ${views.length} view(s) for ${cfg.instId}`);
  for (const v of views) scaffold(v);
  syncAngularJson(views);
  console.log('Done.');
}

main();
