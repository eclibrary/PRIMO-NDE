// src/app/shared/search-tips.ts
//
// SEARCH TIPS ("best bets") — settings searchTips. A box between the search
// results when the search matches, e.g. after result #3 for a search
// containing "statistics": "Looking for figures? Try Eurostat …".
//
// Each tip (searchTips.tips[], a list in the editors) has
//   terms     words / phrases, one per line; EMPTY = every search
//   match     'some'  — the search CONTAINS one of the terms, as whole words
//                       ("climate" matches "climate change policy", not "climates")
//             'exact' — the whole search IS one of the terms
//             Both ignore capitals, accents and punctuation (normalise()).
//   position  after which result (1 = after the first); fewer results on the
//             page → after the last one
//   html      the text per language (sanitised: sanitize.ts)
//   style / color   the notice-banner colour presets (styles: .ec-notice in
//             _ec-features.scss; "custom" = colour picker + automatic text colour)
//   from / until    optional first and last day (scheduled-content.ts rules)
// Several tips can match; those for the same position are shown together, in
// settings order. Only on the FIRST page of results (no offset, or offset=0):
// a best bet is for the start of a search, not for page 7.
//
// THE SEARCH: the `query` parameter(s) of the results page address. NDE writes
// `query=europe`; the VE-style `any,contains,europe` also occurs — the terms
// part is used (same as the Ask-a-librarian context).
//
// PLACEMENT — found in the page, like the notice banners: result rows are
// `nde-search-result-item-container` (verified Oct 2026). Their list item is
// the ancestor directly under the element the rows have in common, so the box
// goes between list items, not inside a result. If that element is a <ul>/<ol>,
// the box is wrapped in an <li> to keep the list valid. NDE redraws the list
// while paging, sorting and filtering, so a MutationObserver re-checks after
// each change (batched per frame; no DOM change when everything is in place).
// `ecSearchTips.probe()` in the console shows what was found.
//
// PLAIN DOM, NO ANGULAR: started from bootstrap.ts, like the banners.
import { EC_CONFIG, EcSearchTip, currentLang, localised } from './ec-config';
import { isWithinSchedule } from './scheduled-content';
import { sanitizeHtml } from './sanitize';
import { readableTextOn } from './colour';

/** NDE result row (verified Oct 2026). */
const ROW = 'nde-search-result-item-container';
/** Icon per style (Material Symbols). */
const ICONS: Record<EcSearchTip['style'], string> = {
  theme: 'tips_and_updates', info: 'tips_and_updates', warning: 'warning', success: 'check_circle', custom: 'tips_and_updates',
};

/** One box per position currently shown (position → element in the page). */
const boxes = new Map<number, HTMLElement>();
/** The address the boxes were built for: rebuilt when the search changes. */
let builtFor = '';

/** Start. Called once from bootstrap.ts. */
export function startSearchTips(): void {
  (window as any).ecSearchTips = { probe };
  const cfg = EC_CONFIG.searchTips;
  if (!cfg?.enabled || !Array.isArray(cfg.tips) || !cfg.tips.length) return;
  const begin = () => {
    update();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    }).observe(document.body, { childList: true, subtree: true });
    // Dates may start/end while the page is open.
    window.setInterval(() => { builtFor = ''; update(); }, 60 * 1000);
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
}

/** Build the boxes for the current search (when it changed) and put them in place. */
function update(): void {
  const key = window.location.pathname + window.location.search;
  if (key !== builtFor) {
    builtFor = key;
    rebuild();
  }
  place();
}

// ------------------------------------------------------------ which tips

/** Rebuild the boxes for the current address (none when not a first results page). */
function rebuild(): void {
  boxes.forEach((b) => (b.closest('.ec-search-tips-item') ?? b).remove()); // with its <li>, if any
  boxes.clear();
  const params = new URLSearchParams(window.location.search);
  const resultsPath = EC_CONFIG.lastSearch?.resultsPath || '/search';
  if (!window.location.pathname.endsWith(resultsPath)) return;
  if (params.get('offset') && params.get('offset') !== '0') return; // first page only

  const query = normalise(params.getAll('query')
    .map((q) => (q.split(',').length >= 3 ? q.split(',').slice(2).join(',') : q))
    .join(' '));
  if (!query) return;

  const lang = currentLang();
  const byPosition = new Map<number, EcSearchTip[]>();
  for (const tip of EC_CONFIG.searchTips!.tips) {
    if (!tip || !matches(tip, query) || !isWithinSchedule(tip.from, tip.until)) continue;
    const html = tip.html ? localised(tip.html, lang) : '';
    if (!html || !html.replace(/<[^>]*>/g, '').trim()) continue; // nothing to say in this language or English
    const pos = Math.max(1, Math.floor(Number(tip.position) || 3));
    if (!byPosition.has(pos)) byPosition.set(pos, []);
    byPosition.get(pos)!.push(tip);
  }
  for (const [pos, tips] of byPosition) boxes.set(pos, box(tips, lang));
}

/** Does `tip` apply to the (normalised) search? */
function matches(tip: EcSearchTip, query: string): boolean {
  const terms = (Array.isArray(tip.terms) ? tip.terms : []).map(normalise).filter(Boolean);
  if (!terms.length) return true; // no terms = every search
  if (tip.match === 'exact') return terms.includes(query);
  const padded = ` ${query} `;
  return terms.some((t) => padded.includes(` ${t} `)); // whole words / phrases
}

/** Lower case, no accents, punctuation → spaces, single spaces. "Économie, UE!" → "economie ue". */
function normalise(text: string): string {
  return (text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// ----------------------------------------------------------------- boxes

/** The element for the tips of one position. */
function box(tips: EcSearchTip[], lang: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ec-search-tips';
  for (const tip of tips) {
    const style = (['theme', 'info', 'warning', 'success', 'custom'] as const).includes(tip.style) ? tip.style : 'info';
    const el = document.createElement('div');
    // Same look as the notice banners (.ec-notice, _ec-features.scss) + spacing for the list.
    el.className = `ec-notice ec-notice--${style} ec-search-tip`;
    el.setAttribute('role', 'note');
    el.setAttribute('aria-label', localised(EC_CONFIG.searchTips!.regionLabel, lang) || 'Search tip');
    if (style === 'custom' && tip.color) {
      el.style.setProperty('--ec-notice-bg', tip.color);
      el.style.setProperty('--ec-notice-fg', readableTextOn(tip.color));
    }
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined ec-notice__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[style];
    const text = document.createElement('div');
    text.className = 'ec-notice__text';
    text.innerHTML = sanitizeHtml(localised(tip.html, lang));
    el.append(icon, text);
    wrap.append(el);
  }
  return wrap;
}

// ------------------------------------------------------------- placement

/** Put each box after its result (no DOM change when already there). */
function place(): void {
  if (!boxes.size) return;
  const items = resultItems();
  if (!items.length) return; // results not drawn (yet)
  for (const [pos, el] of boxes) {
    const anchor = items[Math.min(pos, items.length) - 1];
    // In a <ul>/<ol> the box needs an <li> around it.
    const listParent = anchor.parentElement && /^(UL|OL)$/.test(anchor.parentElement.tagName);
    let node: HTMLElement = el;
    if (listParent) {
      if (el.parentElement?.tagName !== 'LI' || !el.parentElement.classList.contains('ec-search-tips-item')) {
        const li = document.createElement('li');
        li.className = 'ec-search-tips-item';
        li.append(el);
      }
      node = el.parentElement as HTMLElement;
    }
    if (anchor.nextElementSibling !== node) anchor.after(node);
  }
}

/**
 * The list item of every result row: the ancestor of the row that sits
 * directly under the element all rows share. One row: the row itself.
 */
function resultItems(): Element[] {
  const rows = Array.from(document.querySelectorAll(ROW)).filter((r) => !r.closest('.ec-search-tips'));
  if (rows.length < 2) return rows;
  let common: Element | null = rows[0].parentElement;
  while (common && !common.contains(rows[1])) common = common.parentElement;
  if (!common) return rows;
  return rows.map((r) => {
    let e: Element = r;
    while (e.parentElement && e.parentElement !== common) e = e.parentElement;
    return e;
  });
}

/** `ecSearchTips.probe()` in the console: what the code sees on this page. */
function probe(): void {
  const items = resultItems();
  console.info('[ec] search tips probe', {
    enabled: !!EC_CONFIG.searchTips?.enabled,
    tips: EC_CONFIG.searchTips?.tips?.length ?? 0,
    search: new URLSearchParams(window.location.search).getAll('query'),
    rows: document.querySelectorAll(ROW).length,
    firstItem: items[0],
    listElement: items[0]?.parentElement,
    shown: [...boxes.keys()],
  });
}
