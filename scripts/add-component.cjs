#!/usr/bin/env node
/**
 * Generate a new custom component and register it.
 *
 *   npm run component:add                                   -> interactive
 *   npm run component:add -- --name search-tips --scope finder --slot nde-search-bar-after
 *   npm run component:add -- --name cookie-notice --scope shared --slot root
 *   npm run component:add -- --name foo --scope shared --slot none
 *
 * Questions (or flags):
 *   1. name   kebab-case, without the "ec-" prefix (it is added): "search-tips" → EcSearchTipsComponent,
 *             selector custom-ec-search-tips, folder ec-search-tips/
 *   2. scope  shared | <view key from views.config.json>
 *   3. slot   where it renders:
 *               <nde selector>   an NDE slot, e.g. nde-search-bar-after (see docs/nde-selectors.md)
 *               root             (shared only) child of EcSharedRootComponent — for page-level,
 *                                headless features that must not take a slot of their own
 *               none             generate the files only; register later by hand
 *   4. kind   template | headless   (headless = no HTML/SCSS, renders nothing itself)
 *
 * What it writes:
 *   shared: src/app/shared/components/ec-<name>/ec-<name>.component.{ts,html,scss}
 *           + mapping in src/app/shared/shared-mappings.ts, or import+tag in ec-shared-root
 *   view:   src/views/<dir>/components/ec-<name>/…
 *           + mapping in src/views/<dir>/mappings.ts, using the ../../views/… import path
 *             (fileReplacements gotcha: relative imports there resolve from src/app/custom1-module/)
 *
 * Never overwrites: an existing component folder aborts before anything is written.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ROOT, loadConfig } = require('./view-context.cjs');

// ------------------------------------------------------------------ helpers

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else { out[a.slice(2)] = next; i++; }
  }
  return out;
}

function ask(rl, question, { def, validate } = {}) {
  const suffix = def ? ` [${def}]` : '';
  return new Promise((resolve) => {
    const loop = () => rl.question(`${question}${suffix}: `, (raw) => {
      const value = raw.trim() || def || '';
      const err = validate ? validate(value) : null;
      if (err) { console.log(`  ${err}`); return loop(); }
      resolve(value);
    });
    loop();
  });
}

const pascal = (kebab) => kebab.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const fail = (m) => { console.error(m); process.exit(1); };
const read = (f) => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); console.log(`  wrote   ${path.relative(ROOT, f)}`); };
const edit = (f, s) => { fs.writeFileSync(f, s); console.log(`  updated ${path.relative(ROOT, f)}`); };

// ---------------------------------------------------------------- templates

function componentTs({ name, className, selector, slot, scope, kind, cfgHint }) {
  const headless = kind === 'headless';
  const where = scope === 'shared' ? 'all views' : `the "${scope}" view only`;
  const mount = slot === 'root' ? 'child of EcSharedRootComponent (see ec-shared-root.component.ts)'
    : slot === 'none' ? 'NOT registered yet — add it to a mappings file'
      : `'${slot}' in ${scope === 'shared' ? 'src/app/shared/shared-mappings.ts' : `src/views/${scope}/mappings.ts`}`;
  const cfgImport = scope === 'shared' ? "'../../ec-config'" : "'../../../../app/shared/ec-config'";
  return `// ${name}.component.ts
//
// TODO: one paragraph on what this component does and why it exists.
//
// SCOPE: ${where}.
// MOUNT POINT: ${mount}.
// SETTINGS: read them from EC_CONFIG (config/global.json + config/views/<view>.json);
//   ${cfgHint}
// HOST: when mounted on an NDE slot, \`hostComponent\` is the NDE component instance
//   the slot belongs to (undocumented shape — log it once while developing).
import { Component, Input, inject } from '@angular/core';
import { EC_CONFIG, currentLang, localised } from ${cfgImport};
${headless ? '' : "import { CommonModule } from '@angular/common';\n"}
@Component({
  selector: '${selector}',
  standalone: true,${headless ? '' : '\n  imports: [CommonModule],'}
  host: { 'data-component-id': '${selector}' },
${headless
    ? "  template: '', // headless: renders nothing; side effects only"
    : `  templateUrl: './${name}.component.html',\n  styleUrls: ['./${name}.component.scss'],`}
})
export class ${className} {
  /** NDE component this slot belongs to (injected by the shell). Undefined for root children. */
  @Input() hostComponent: any;

  // Example of a localised string from settings — replace or remove.
  // readonly title = localised(EC_CONFIG.someSection.title, currentLang());

  constructor() {
    // TODO
  }
}
`;
}

const componentHtml = (name) => `<!-- ${name}: TODO template. Use NDE's utility classes (flex-row, margin-top-medium, …) and
     the theme tokens (--sys-*, --ec-*) rather than fixed colours. -->
<div class="${name}">
  ${name} works
</div>
`;

const componentScss = (name) => `// ${name} — component styles (emulated encapsulation: they only apply inside this component).
// Colours: prefer NDE's --sys-* tokens and the EC tokens (--ec-blue, --ec-yellow).
.${name} {
  display: block;
}
`;

// ------------------------------------------------------------- registration

/** Insert an import line after the last existing import in a TS file. */
function addImport(src, line) {
  if (src.includes(line)) return src;
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(nl);
  let last = -1;
  lines.forEach((l, i) => { if (/^import .* from /.test(l)) last = i; });
  lines.splice(last + 1, 0, line);
  return lines.join(nl);
}

function registerShared(slot, { className, name, importPath }) {
  const file = path.join(ROOT, 'src', 'app', 'shared', 'shared-mappings.ts');
  let src = read(file);
  src = addImport(src, `import { ${className} } from '${importPath}';`);
  const entry = `\n  // TODO: describe why ${className} lives on this slot.\n  ['${slot}', ${className}],\n`;
  const idx = src.lastIndexOf('];');
  if (idx < 0) fail('shared-mappings.ts: could not find the closing "];" of sharedSelectorMappings');
  src = src.slice(0, idx).replace(/\s*$/, '\n') + entry + src.slice(idx);
  edit(file, src);
}

function registerRootChild({ className, selector, name }) {
  const file = path.join(ROOT, 'src', 'app', 'shared', 'components', 'ec-shared-root', 'ec-shared-root.component.ts');
  let src = read(file);
  src = addImport(src, `import { ${className} } from '../${name}/${name}.component';`);
  src = src.replace(/imports: \[([^\]]*)\]/, (m, list) => list.includes(className) ? m : `imports: [${list.trim()}, ${className}]`);
  // Files may have CRLF endings (Windows checkouts): match either.
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  src = src.replace(/(template: `\r?\n)([\s\S]*?)(\r?\n  `,)/, (m, open, body, close) =>
    body.includes(`<${selector}>`) ? m : `${open}${body}${nl}    <${selector}></${selector}>${close}`);
  edit(file, src);
}

function registerView(viewDir, slot, { className, importPath }) {
  const file = path.join(ROOT, 'src', 'views', viewDir, 'mappings.ts');
  if (!fs.existsSync(file)) fail(`${path.relative(ROOT, file)} not found — run "npm run views:sync" first`);
  let src = read(file);
  src = addImport(src, `import { ${className} } from '${importPath}';`);
  const entry = `\n  // TODO: describe why ${className} lives on this slot.\n  ['${slot}', ${className}],\n`;
  const idx = src.lastIndexOf(']);');
  if (idx < 0) fail(`${path.relative(ROOT, file)}: could not find the closing "]);" of selectorComponentMap`);
  src = src.slice(0, idx).replace(/\s*$/, '\n') + entry + src.slice(idx);
  edit(file, src);
}

// ------------------------------------------------------------------------ main

async function main() {
  const cfg = loadConfig();
  const viewKeys = Object.keys(cfg.views);
  const args = parseArgs(process.argv.slice(2));
  const scopes = ['shared', ...viewKeys];

  const validators = {
    name: (v) => (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v) ? 'kebab-case, letters/digits, e.g. "search-tips"'
      : v.startsWith('ec-') ? 'leave out the "ec-" prefix, it is added' : null),
    scope: (v) => (scopes.includes(v) ? null : `one of: ${scopes.join(', ')}`),
    slot: (v, scope) => (v === 'none' ? null : v === 'root' ? (scope === 'shared' ? null : '"root" is only for shared components')
      : /^[a-z][a-z0-9-]*$/.test(v) ? null : 'an NDE selector like nde-search-bar-after, or "root", or "none"'),
    kind: (v) => (['template', 'headless'].includes(v) ? null : 'template | headless'),
  };

  let a;
  if (args.name && args.scope) {
    a = { name: args.name, scope: args.scope, slot: args.slot || 'none', kind: args.kind || 'template' };
    for (const [k, fn] of Object.entries(validators)) { const err = fn(a[k], a.scope); if (err) fail(`--${k}: ${err}`); }
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    a = {};
    console.log('\nNew custom component');
    a.name = await ask(rl, 'Name (kebab-case, without "ec-")', { def: args.name, validate: validators.name });
    a.scope = await ask(rl, `Scope (${scopes.join(' | ')})`, { def: args.scope || 'shared', validate: validators.scope });
    a.slot = await ask(rl, 'Slot: NDE selector, "root" (shared page-level child) or "none"', { def: args.slot || 'none', validate: (v) => validators.slot(v, a.scope) });
    a.kind = await ask(rl, 'Kind (template | headless)', { def: args.kind || (a.slot === 'root' ? 'headless' : 'template'), validate: validators.kind });
    rl.close();
  }

  const name = `ec-${a.name}`;
  const className = `Ec${pascal(a.name)}Component`;
  const selector = `custom-${name}`;
  const viewDir = a.scope === 'shared' ? null : (cfg.views[a.scope].dir || a.scope);
  const dir = a.scope === 'shared'
    ? path.join(ROOT, 'src', 'app', 'shared', 'components', name)
    : path.join(ROOT, 'src', 'views', viewDir, 'components', name);
  if (fs.existsSync(dir)) fail(`${path.relative(ROOT, dir)} already exists — pick another name.`);

  const cfgHint = a.scope === 'shared'
    ? 'global.json for all views, overridable per view; add new keys to config/schema.json + EcConfigValues.'
    : `keep view-only settings in config/views/${a.scope}.json (declare them optional in the schema, like network).`;

  console.log('');
  write(path.join(dir, `${name}.component.ts`), componentTs({ name, className, selector, slot: a.slot, scope: a.scope, kind: a.kind, cfgHint }));
  if (a.kind === 'template') {
    write(path.join(dir, `${name}.component.html`), componentHtml(name));
    write(path.join(dir, `${name}.component.scss`), componentScss(name));
  }

  if (a.slot === 'none') {
    console.log(`\nNot registered. Add ['<nde-selector>', ${className}] to ${a.scope === 'shared' ? 'src/app/shared/shared-mappings.ts' : `src/views/${viewDir}/mappings.ts`} when ready.`);
  } else if (a.scope === 'shared' && a.slot === 'root') {
    registerRootChild({ className, selector, name });
  } else if (a.scope === 'shared') {
    registerShared(a.slot, { className, name, importPath: `./components/${name}/${name}.component` });
  } else {
    // fileReplacements gotcha: paths in a view's mappings.ts must resolve from src/app/custom1-module/ too.
    registerView(viewDir, a.slot, { className, importPath: `../../views/${viewDir}/components/${name}/${name}.component` });
  }

  console.log(`
Done: ${className} (<${selector}>)
  1. Fill in the TODOs in ${path.relative(ROOT, dir)}/
  2. ${a.scope === 'shared' ? 'npm run start:proxy -- <view>' : `npm run start:proxy -- ${a.scope}`}  and check the slot renders
  3. If it needs settings: config/schema.json → EcConfigValues (ec-config.ts) → config/global.json
`);
}

main().catch((err) => fail(err.message || String(err)));
