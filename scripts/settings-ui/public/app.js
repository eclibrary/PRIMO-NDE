/*
  Settings UI — browser side. No framework, no build step.

  Everything on screen is rendered from config/schema.json, so adding a setting
  to the schema (with title/description) is all it takes for it to appear here.

  Tabs:
    Global            edits config/global.json
    <each view>       edits config/views/<key>.json — shows the MERGED value for
                      every field; fields not overridden are greyed ("inherited")
                      with an "Override" button; overridden ones are editable with
                      "Use global". Only overrides are written to the view file.
    Return labels     edits data/return-labels.json
    Views             edits views.config.json (id/label/host) and adds views
    Languages         edits config/languages.json — add/remove UI languages for
                      all views (scripts/languages.cjs does the work: schema,
                      settings files, homepage/header/footer HTML files)

  Field kinds (from the schema): scalar (string/number/boolean/enum), list
  (array of strings — one per line), map (object with additionalProperties —
  key/value table), localised (object with en/fr/de — one input per language,
  or one large textarea per language when the schema says `"format": "html"`,
  e.g. the welcome message), and nested objects with `properties`, rendered as
  fieldsets.

  Collapsible panels (Oct 2026): on the Global and view tabs every top-level
  section is a <details> panel, closed by default. The summary line shows the
  section title, an on/off chip when the section has an `enabled` switch, and
  (view tabs) how many settings the view overrides. Which panels are open is
  remembered per tab in memory AND in localStorage (key OPEN_KEY), because the
  whole tab is re-rendered on every Override / Use global / Enable click — without
  that, the panel you are working in would snap shut on each click.
*/

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};

let state = null;         // bootstrap payload from the server
let active = 'global';    // current tab id
let draft = null;         // working copy of the active tab's data
let dirty = false;

// ------------------------------------------------------- collapsible panels

/** localStorage key holding { "<tab id>": ["sectionKey", …] } — the open panels per tab. */
const OPEN_KEY = 'nde-settings-ui:open-panels';
/** In-memory copy (localStorage may be unavailable; the UI must work without it). */
let openPanels = (() => {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { return {}; }
})();

/** Is the panel for section `key` open on the current tab? */
function isOpen(key) {
  return (openPanels[active] || []).includes(key);
}

/** Remember that the panel for `key` on the current tab is open/closed. */
function rememberOpen(key, open) {
  const set = new Set(openPanels[active] || []);
  if (open) set.add(key); else set.delete(key);
  openPanels[active] = [...set];
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(openPanels)); } catch { /* storage blocked: memory only */ }
}

/**
 * A collapsible top-level panel:
 *   <details class="card" data-key="welcomeMessage">
 *     <summary><h2>Title</h2> <span class="chip on">on</span> <span class="chip">2 overrides</span></summary>
 *     …description and fields…
 *   </details>
 * `chips` = small labels shown in the summary line (useful while closed).
 */
function panel(key, title, chips, ...children) {
  const details = el('details', { class: 'card', 'data-key': key },
    el('summary', {}, el('h2', {}, title), ...chips),
    ...children);
  details.open = isOpen(key);
  // `toggle` also fires when we set .open programmatically (Expand/Collapse
  // all) — that is fine, it records the same state.
  details.addEventListener('toggle', () => rememberOpen(key, details.open));
  return details;
}

/** Summary chips for a section: on/off (if it has `enabled`) and the override count (view tabs). */
function sectionChips(key, schema, ctx) {
  const chips = [];
  if (schema.properties && schema.properties.enabled) {
    const on = getPath(ctx.data, [key, 'enabled']) === true;
    chips.push(el('span', { class: `chip ${on ? 'on' : 'off'}` }, on ? 'on' : 'off'));
  }
  if (ctx.overrides) {
    const n = countLeaves(getPath(ctx.overrides, [key]));
    if (n > 0) chips.push(el('span', { class: 'chip overridden' }, `${n} override${n === 1 ? '' : 's'}`));
  }
  return chips;
}

/** Number of overridden values below an override object (objects recurse; arrays/scalars count 1). */
function countLeaves(v) {
  if (v === undefined) return 0;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v).reduce((n, x) => n + countLeaves(x), 0);
  }
  return 1;
}

/** "Expand all · Collapse all" row above the panels of a config tab. */
function panelToolbar() {
  const setAll = (open) => document.querySelectorAll('#main details.card').forEach((d) => { d.open = open; });
  return el('div', { class: 'panel-tools' },
    el('button', { type: 'button', class: 'link', onclick: () => setAll(true) }, 'Expand all'),
    el('span', { 'aria-hidden': 'true' }, '·'),
    el('button', { type: 'button', class: 'link', onclick: () => setAll(false) }, 'Collapse all'));
}

// ---------------------------------------------------------------- schema utils

/**
 * Follow a `$ref` to its definition. Keys written NEXT TO the $ref in the schema
 * (title, description, format) are kept and win over the definition's own, so
 * e.g. `{ "$ref": "#/definitions/localised", "title": "Modal title" }` shows its
 * title here instead of the bare key. (The build validator ignores those extra
 * keys, as JSON Schema draft-07 prescribes — they are presentation only.)
 */
function resolve(schema) {
  if (!schema?.$ref) return schema;
  const { $ref, ...own } = schema;
  const target = $ref.replace('#/', '').split('/').reduce((o, k) => o?.[k], state.schema);
  return { ...target, ...own };
}
// A "localised" unit is an object whose keys are only languages AND whose values
// are strings; {en: {...}, fr: {...}} (e.g. the context line labels) is a nested object.
/** Languages come from the schema's `localised` definition (en, fr, de, …) — never hard-code them here. */
const languages = () => Object.keys(state.schema.definitions.localised.properties);
const isLocalised = (s) => s?.properties && 'en' in s.properties
  && Object.keys(s.properties).every((k) => languages().includes(k))
  && resolve(s.properties.en).type === 'string';
const kindOf = (s) => {
  s = resolve(s);
  if (s.enum) return 'enum';
  if (s.type === 'boolean') return 'boolean';
  if (s.type === 'integer' || s.type === 'number') return 'number';
  if (s.type === 'string') return 'string';
  if (s.type === 'array') return 'list';
  if (s.type === 'object' && s.additionalProperties && !s.properties) return 'map';
  if (s.type === 'object' && isLocalised(s)) return 'localised';
  if (s.type === 'object') return 'object';
  return 'string';
};

const getPath = (obj, p) => p.reduce((o, k) => o?.[k], obj);
function setPath(obj, p, value) {
  let o = obj;
  for (const k of p.slice(0, -1)) o = o[k] ??= {};
  o[p[p.length - 1]] = value;
}
function deletePath(obj, p) {
  const parent = getPath(obj, p.slice(0, -1));
  if (parent) delete parent[p[p.length - 1]];
  // prune empty parents so the override file stays tidy
  if (p.length > 1 && parent && Object.keys(parent).length === 0) deletePath(obj, p.slice(0, -1));
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const has = (obj, p) => getPath(obj, p) !== undefined;

// ------------------------------------------------------------------ rendering

function markDirty() {
  dirty = true;
  $('#status').textContent = 'Unsaved changes';
  $('#status').className = 'status';
}

/** One editable unit. `ctx` = { data, overrides } — overrides is null on the global tab. */
function renderField(key, schema, path, ctx) {
  schema = resolve(schema);
  const kind = kindOf(schema);
  const value = getPath(ctx.data, path);
  const inherited = ctx.overrides !== null && !has(ctx.overrides, path);
  const field = el('div', { class: `field${inherited ? ' inherited' : ''}` });

  const label = el('label', {}, schema.title || key, schema.description ? el('small', {}, schema.description) : null);
  const control = el('div', { class: 'control' });
  const onChange = (v) => {
    setPath(ctx.data, path, v);
    if (ctx.overrides) setPath(ctx.overrides, path, v);
    markDirty();
  };

  switch (kind) {
    case 'boolean':
      control.append(el('input', { type: 'checkbox', ...(value ? { checked: '' } : {}), onchange: (e) => onChange(e.target.checked) }));
      break;
    case 'number':
      control.append(el('input', { type: 'number', value: value ?? '', min: schema.minimum, oninput: (e) => onChange(e.target.value === '' ? undefined : Number(e.target.value)) }));
      break;
    case 'enum': {
      const sel = el('select', { onchange: (e) => onChange(e.target.value) }, schema.enum.map((o) => el('option', { value: o, ...(o === value ? { selected: '' } : {}) }, o)));
      control.append(sel);
      break;
    }
    case 'string':
      control.append(el('input', { type: schema.format === 'uri' ? 'url' : 'text', value: value ?? '', oninput: (e) => onChange(e.target.value) }));
      break;
    case 'list':
      control.append(
        el('textarea', { oninput: (e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) }, (value ?? []).join('\n')),
        el('p', { class: 'hint' }, 'One entry per line.'),
      );
      break;
    case 'localised': {
      // `"format": "html"` on the schema entry (e.g. welcomeMessage.html) = long
      // HTML markup: a large textarea per language instead of a one-line input.
      const isHtml = schema.format === 'html';
      for (const lang of languages()) {
        // Same handler for both widgets: an emptied non-English entry is removed
        // from the JSON (so the English fallback applies); `en` is required and stays.
        const oninput = (e) => {
          const next = { ...(getPath(ctx.data, path) ?? {}) };
          if (e.target.value === '' && lang !== 'en') delete next[lang]; else next[lang] = e.target.value;
          onChange(next);
        };
        const input = isHtml
          // The text goes in as a child text node, so markup in it is shown, not interpreted.
          ? el('textarea', { class: 'html', spellcheck: 'false', oninput }, value?.[lang] ?? '')
          : el('input', { type: 'text', value: value?.[lang] ?? '', oninput });
        control.append(el('div', { class: `row${isHtml ? ' top' : ''}` }, el('span', { class: 'lang' }, lang), input));
      }
      if (isHtml) control.append(el('p', { class: 'hint' }, 'HTML markup. Leave FR/DE empty to fall back to English.'));
      break;
    }
    case 'map': {
      const entries = Object.entries(value ?? {});
      const valSchema = resolve(schema.additionalProperties);
      const table = el('table', {}, el('tbody', {}, entries.map(([k, v]) => mapRow(k, v))));
      function mapRow(k, v) {
        const tr = el('tr');
        const kIn = el('input', { type: 'text', value: k, placeholder: 'field name' });
        const vIn = valSchema.enum
          ? el('select', {}, valSchema.enum.map((o) => el('option', { value: o, ...(o === v ? { selected: '' } : {}) }, o)))
          : el('input', { type: 'text', value: v ?? '', placeholder: 'value' });
        const commit = () => {
          const next = {};
          for (const row of table.querySelectorAll('tr')) {
            const [ki, vi] = row.querySelectorAll('input, select');
            if (ki.value.trim()) next[ki.value.trim()] = vi.value;
          }
          onChange(next);
        };
        kIn.addEventListener('input', commit); vIn.addEventListener('input', commit); vIn.addEventListener('change', commit);
        tr.append(el('td', {}, kIn), el('td', {}, vIn), el('td', {}, el('button', { type: 'button', class: 'del', title: 'Remove', onclick: () => { tr.remove(); commit(); } }, '✕')));
        return tr;
      }
      control.append(table, el('button', { type: 'button', class: 'add secondary', onclick: () => { table.tBodies[0].append(mapRow('', valSchema.enum?.[0] ?? '')); markDirty(); } }, '+ Add'));
      break;
    }
  }

  field.append(label, control);
  if (ctx.overrides !== null) {
    const btn = el('button', { type: 'button', onclick: () => {
      if (inherited) setPath(ctx.overrides, path, clone(getPath(ctx.data, path)));
      else { deletePath(ctx.overrides, path); setPath(ctx.data, path, clone(getPath(state.global, path))); }
      markDirty();
      render();
    } }, inherited ? 'Override for this view' : 'Use global');
    field.append(el('div', { class: 'override' }, btn));
  }
  return field;
}

/** An object with `properties` → fieldset (top level: card). */
function renderObject(key, schema, path, ctx, top = false) {
  schema = resolve(schema);
  // Top level = collapsible panel (see panel()); nested objects stay fieldsets.
  const container = top
    ? panel(key, schema.title || key, sectionChips(key, schema, ctx), schema.description ? el('p', { class: 'desc' }, schema.description) : null)
    : el('fieldset', {}, el('legend', {}, schema.title || key), schema.description ? el('p', { class: 'desc' }, schema.description) : null);
  for (const [k, sub] of Object.entries(schema.properties || {})) {
    const p = [...path, k];
    const r = resolve(sub);
    if (kindOf(r) === 'object') container.append(renderObject(k, r, p, ctx));
    else container.append(renderField(k, r, p, ctx));
  }
  return container;
}

function renderConfigTab(viewKey) {
  const main = $('#main'); main.replaceChildren();
  const isGlobal = viewKey === null;
  const ctx = isGlobal
    ? { data: draft, overrides: null }
    : { data: draft.merged, overrides: draft.overrides };
  main.append(el('p', { class: 'intro' }, isGlobal
    ? 'Values for every view (config/global.json). A view tab can override any of them.'
    : `Values for this view (config/views/${viewKey}.json). Greyed fields are inherited from Global; override them here, or "Use global" to remove an override.`));
  main.append(panelToolbar());
  for (const [k, sub] of Object.entries(state.schema.properties)) {
    const r = resolve(sub);
    // Optional feature sections (e.g. printReturnLabel) show on views only when present,
    // and offer an "Enable" button otherwise; on Global they are simply listed if present.
    const present = getPath(ctx.data, [k]) !== undefined;
    if (kindOf(r) === 'object' && !present) {
      if (state.schema.required?.includes(k)) continue;
      main.append(panel(k, r.title || k, [el('span', { class: 'chip off' }, 'not enabled here')],
        el('p', { class: 'desc' }, r.description || ''),
        el('div', { class: 'actions' }, el('button', { type: 'button', class: 'secondary', onclick: () => {
          // Keep the panel open after the re-render, so the new fields are in view.
          rememberOpen(k, true);
          setPath(ctx.data, [k], {}); if (ctx.overrides) setPath(ctx.overrides, [k], {}); markDirty(); render();
        } }, `Enable "${r.title || k}" here`))));
      continue;
    }
    main.append(kindOf(r) === 'object' ? renderObject(k, r, [k], ctx, true) : renderField(k, r, [k], ctx));
  }
  $('#bar').hidden = false;
}

function renderReturnLabels() {
  const main = $('#main'); main.replaceChildren();
  main.append(el('p', { class: 'intro' }, 'Return labels per Alma library code (data/return-labels.json). Lines are printed in order; a library without lines gets no label. Saving also regenerates the package file.'));
  const tbody = el('tbody');
  const row = (code, entry) => {
    const tr = el('tr');
    const codeIn = el('input', { type: 'text', value: code, placeholder: 'CODE' });
    const nameIn = el('input', { type: 'text', value: entry.name ?? '', placeholder: 'Library name' });
    const linesIn = el('textarea', { placeholder: 'Label lines, one per line' }, (entry.returnAddress ?? []).join('\n'));
    const commit = () => { rebuild(); markDirty(); };
    [codeIn, nameIn, linesIn].forEach((i) => i.addEventListener('input', commit));
    tr.append(el('td', {}, codeIn), el('td', {}, nameIn), el('td', {}, linesIn),
      el('td', {}, el('button', { type: 'button', class: 'del', title: 'Remove', onclick: () => {
        const label = codeIn.value.trim() || 'this row';
        if (!confirm(`Remove the return label for ${label}? (Nothing is written until you Save.)`)) return;
        tr.remove(); commit();
      } }, '✕')));
    return tr;
  };
  const rebuild = () => {
    const next = {};
    for (const [k, v] of Object.entries(state.returnLabels)) if (k.startsWith('_')) next[k] = v; // keep _comment
    for (const tr of tbody.querySelectorAll('tr')) {
      const [code, name, lines] = tr.querySelectorAll('input, textarea');
      if (!code.value.trim()) continue;
      const entry = { name: name.value.trim() };
      const arr = lines.value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (arr.length) entry.returnAddress = arr;
      next[code.value.trim()] = entry;
    }
    draft = next;
  };
  for (const [code, entry] of Object.entries(draft)) if (!code.startsWith('_')) tbody.append(row(code, entry));
  main.append(el('section', { class: 'card' },
    el('table', { class: 'labels' }, el('thead', {}, el('tr', {}, el('th', {}, 'Code'), el('th', {}, 'Name'), el('th', {}, 'Label lines'), el('th'))), tbody),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'secondary', onclick: () => { tbody.append(row('', {})); markDirty(); } }, '+ Add library'))));
  $('#bar').hidden = false;
}

function renderViews() {
  const main = $('#main'); main.replaceChildren();
  main.append(el('p', { class: 'intro' }, 'The views this repo builds (views.config.json). Saving scaffolds any new view (src/views/<key>/, angular.json) and creates its settings file. Deleting a row and saving removes the view completely from this repo: its folder under src/views/, its settings file, its build output and its angular.json configurations (the view in Alma is not touched). Leftovers of views deleted before this worked: run npm run views:remove -- --orphans.'));
  const tbody = el('tbody');
  const row = (key, v) => {
    const tr = el('tr');
    const inputs = {
      key: el('input', { type: 'text', value: key, placeholder: 'key (e.g. pubs2)', ...(key ? { readonly: '' } : {}) }),
      viewId: el('input', { type: 'text', value: v.viewId ?? '', placeholder: 'VIEW_ID' }),
      label: el('input', { type: 'text', value: v.label ?? '', placeholder: 'Label' }),
      host: el('input', { type: 'url', value: v.host ?? '', placeholder: `default: ${draft.defaultHost}` }),
    };
    const commit = () => { rebuild(); markDirty(); };
    Object.values(inputs).forEach((i) => i.addEventListener('input', commit));
    tr.append(...Object.values(inputs).map((i) => el('td', {}, i)),
      el('td', {}, key ? el('button', { type: 'button', class: 'secondary', onclick: () => build(key) }, 'Build') : null),
      el('td', {}, el('button', { type: 'button', class: 'del', title: 'Remove', onclick: () => {
        const label = inputs.key.value.trim() || 'this row';
        if (!confirm(`Remove view "${label}"? When you Save, its folder under src/views/, its settings file (config/views/), its build output (dist/) and its angular.json configurations are DELETED. The view in Alma is not touched. (Nothing happens until you Save.)`)) return;
        tr.remove(); commit();
      } }, '✕')));
    return tr;
  };
  const rebuild = () => {
    const views = {};
    for (const tr of tbody.querySelectorAll('tr')) {
      const [key, viewId, label, host] = tr.querySelectorAll('input');
      if (!key.value.trim()) continue;
      const entry = { viewId: viewId.value.trim(), label: label.value.trim(), dir: draft.views[key.value.trim()]?.dir ?? key.value.trim() };
      if (host.value.trim()) entry.host = host.value.trim();
      views[key.value.trim()] = entry;
    }
    draft.views = views;
  };
  for (const [key, v] of Object.entries(draft.views)) tbody.append(row(key, v));
  main.append(el('section', { class: 'card' },
    el('div', { class: 'field' }, el('label', {}, 'Institution', el('small', {}, 'Alma institution code, part of every vid.')),
      el('div', { class: 'control' }, el('input', { type: 'text', value: draft.instId, oninput: (e) => { draft.instId = e.target.value.trim(); markDirty(); } }))),
    el('div', { class: 'field' }, el('label', {}, 'Default Primo host', el('small', {}, 'Used by views without their own host.')),
      el('div', { class: 'control' }, el('input', { type: 'url', value: draft.defaultHost, oninput: (e) => { draft.defaultHost = e.target.value.trim(); markDirty(); } }))),
    el('table', { class: 'views' }, el('thead', {}, el('tr', {}, el('th', {}, 'Key'), el('th', {}, 'View ID'), el('th', {}, 'Label'), el('th', {}, 'Host'), el('th'), el('th'))), tbody),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'secondary', onclick: () => { tbody.append(row('', {})); markDirty(); } }, '+ Add view'))));
  $('#bar').hidden = false;
}

/**
 * Languages tab: the UI languages of ALL views (config/languages.json).
 * English is fixed in first place (fallback for every text). Saving goes through
 * a dry-run first, so removing a language shows exactly which translations and
 * files will be deleted before anything happens.
 */
function renderLanguages() {
  const main = $('#main'); main.replaceChildren();
  main.append(el('p', { class: 'intro' },
    'The UI languages of all views. Adding one gives every translatable text in the settings a field for it, and creates homepage/header/footer HTML files for it (copies of the English ones, to translate). ',
    'Removing one deletes its translations and those files. English cannot be removed: it is shown whenever a translation is missing. ',
    'Also enable the language for each view in Alma — otherwise NDE never offers it.'));
  const tbody = el('tbody');
  const rebuild = () => {
    draft = [...tbody.querySelectorAll('tr')].map((tr) => {
      const [code, name] = tr.querySelectorAll('input');
      return { code: code.value.trim().toLowerCase(), name: name.value.trim() };
    }).filter((l) => l.code || l.name);
  };
  const row = (l, isNew) => {
    const fixed = l.code === 'en';
    const code = el('input', { type: 'text', value: l.code || '', placeholder: 'e.g. it', maxlength: '2', size: '4', ...(isNew ? {} : { readonly: '' }) });
    const name = el('input', { type: 'text', value: l.name || '', placeholder: 'e.g. Italiano' });
    [code, name].forEach((i) => i.addEventListener('input', () => { rebuild(); markDirty(); }));
    const tr = el('tr', {}, el('td', {}, code), el('td', {}, name),
      el('td', {}, fixed ? el('span', { class: 'muted' }, 'fallback — always present') : el('button', { type: 'button', class: 'del', title: 'Remove', onclick: () => {
        tr.remove(); rebuild(); markDirty();
      } }, '✕')));
    return tr;
  };
  for (const l of draft) tbody.append(row(l, false));
  main.append(el('section', { class: 'card' },
    el('table', { class: 'views' }, el('thead', {}, el('tr', {}, el('th', {}, 'Code'), el('th', {}, 'Name'), el('th'))), tbody),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'secondary', onclick: () => { tbody.append(row({}, true)); markDirty(); } }, '+ Add language'))));
  $('#bar').hidden = false;
}

function render() {
  const tabs = $('#tabs'); tabs.replaceChildren();
  const tab = (id, text) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === active), onclick: () => switchTab(id) }, text);
  tabs.append(tab('global', 'Global'), el('span', { class: 'group' }, 'Views:'));
  for (const [key, v] of Object.entries(state.views)) tabs.append(tab(`view:${key}`, `${v.label} (${v.viewId})`));
  tabs.append(el('span', { class: 'group' }, '·'), tab('labels', 'Return labels'), tab('views', 'Views'), tab('languages', 'Languages'));

  if (active === 'global') renderConfigTab(null);
  else if (active.startsWith('view:')) renderConfigTab(active.slice(5));
  else if (active === 'labels') renderReturnLabels();
  else if (active === 'languages') renderLanguages();
  else renderViews();
}

// ------------------------------------------------------------------ actions

function loadDraft() {
  if (active === 'global') draft = clone(state.global);
  else if (active.startsWith('view:')) draft = clone(state.views[active.slice(5)]);
  else if (active === 'labels') draft = clone(state.returnLabels);
  else if (active === 'languages') draft = clone(state.languages);
  else draft = clone(state.viewsConfig);
  dirty = false;
  $('#status').textContent = '';
  $('#status').className = 'status';
}

function switchTab(id) {
  if (dirty && !confirm('Discard unsaved changes?')) return;
  active = id;
  loadDraft();
  render();
}

async function refresh() {
  state = await (await fetch('/api/bootstrap')).json();
  $('#root').textContent = state.root;
  if (active.startsWith('view:') && !state.views[active.slice(5)]) active = 'global';
  loadDraft();
  render();
}

async function save() {
  let url, body;
  if (active === 'global') { url = '/api/global'; body = draft; }
  else if (active.startsWith('view:')) { url = `/api/views/${active.slice(5)}`; body = draft.overrides; }
  else if (active === 'labels') { url = '/api/return-labels'; body = draft; }
  else if (active === 'languages') {
    url = '/api/languages'; body = { languages: draft };
    // Dry run first: show what will be created/deleted, and insist on a
    // confirmation when a language (with its translations and files) goes.
    const plan = await fetch('/api/languages/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const pj = await plan.json();
    if (!plan.ok) {
      $('#status').textContent = 'Not saved:\n' + (pj.errors || ['unknown error']).join('\n');
      $('#status').className = 'status err';
      return;
    }
    const verb = pj.removed.length ? 'DELETES' : 'changes';
    if (!confirm(`This ${verb}:\n\n${pj.lines.join('\n')}\n\nContinue?`)) return;
  }
  else { url = '/api/views-config'; body = draft; }

  $('#save').disabled = true;
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) {
      $('#status').textContent = 'Not saved:\n' + (json.errors || ['unknown error']).join('\n');
      $('#status').className = 'status err';
      return;
    }
    await refresh();
    $('#status').textContent = 'Saved. Remember: changes reach Primo only after a build + package upload.';
    $('#status').className = 'status ok';
  } finally {
    $('#save').disabled = false;
  }
}

function build(key) {
  if (dirty && !confirm('There are unsaved changes; the build uses the saved files. Continue?')) return;
  const dlg = $('#buildDialog'), log = $('#buildLog'), result = $('#buildResult');
  $('#buildTitle').textContent = `Building ${key}…`;
  log.textContent = ''; result.textContent = '';
  dlg.showModal();
  const es = new EventSource(`/api/build/${key}`);
  es.addEventListener('log', (e) => { log.textContent += JSON.parse(e.data); log.scrollTop = log.scrollHeight; });
  es.addEventListener('done', (e) => {
    const { code, zip } = JSON.parse(e.data);
    $('#buildTitle').textContent = code === 0 ? `Build of ${key} finished` : `Build of ${key} FAILED (exit ${code})`;
    result.textContent = code === 0 ? `Upload this file in Alma (Manage Customization Package): ${zip}` : 'See the log above.';
    es.close();
  });
  es.onerror = () => { es.close(); };
}

// ------------------------------------------------------------------- boot

$('#save').addEventListener('click', save);
$('#reload').addEventListener('click', () => { if (!dirty || confirm('Discard unsaved changes?')) { loadDraft(); render(); } });
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
refresh().catch((err) => { $('#main').textContent = `Could not load: ${err.message}`; });
