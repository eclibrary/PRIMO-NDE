// src/app/shared/notice-banners.ts
//
// NOTICE BANNERS — coloured message bars on every page ("The library is closed
// on 1 May", "New: chat with a librarian"). Settings: noticeBanners (a list;
// edited in all three editors). Each banner has
//   text         HTML per language (sanitised here, see sanitize.ts)
//   position     top | belowMenu | belowSearch | bottom   (see PLACEMENT)
//   style        theme | info | warning | success | custom  (+ color for custom)
//   from, until  "YYYY-MM-DD" — shown from the start of `from` to the end of
//                `until`; empty = no limit (same rules as scheduled content)
//   dismissible  × button; closing is remembered (see DISMISSING)
//
// PLAIN DOM, NO ANGULAR: started from bootstrap.ts, so banners show on every
// page — also where none of our Angular components is mounted (the shared root
// sits on a search-bar slot). The banners are our own elements, inserted next
// to NDE's; NDE does not know about them.
//
// PLACEMENT — NDE has no documented slot for "under the menu", so the places
// are FOUND in the page (functions topBar() and searchArea()):
//   top          right before the top bar (the strip with NDE's main menu)
//   belowMenu    right after the top bar
//   belowSearch  right after the search area (home page: the banner with the
//                search box; results/record pages: the search bar). Pages
//                without a visible search area: like belowMenu.
//   bottom       fixed to the bottom of the window, over the page; the page
//                gets extra space at the end so nothing hides behind it.
// The TOP BAR is found from NDE's main menu (data-qa="main-menu_links",
// verified Oct 2026 — see ec-menu-links.component.ts) by walking up to the
// largest ancestor that does not also hold the page content. If the menu is
// not found (other NDE release, mobile layout), top/belowMenu banners go at
// the very top of the app and a console line says so — run
// `ecNoticeBanners.probe()` in the console to see what was found.
// NDE re-renders parts of the page while you navigate, so a MutationObserver
// puts the banners back in place when they were moved or removed (batched to
// one check per animation frame; no work when everything is in place).
//
// DISMISSING: the × hides the banner and remembers that in localStorage under
// "ec:notice:<fingerprint>"; the fingerprint is made from the banner's texts
// and dates, so EDITING a banner shows it again to everybody. On reading room
// PCs (kiosk mode) sessionStorage is used instead, which the idle reset clears
// — the next visitor sees the banner again. Kiosk's purge also removes the
// localStorage keys (purgeEcLocalStorage in kiosk.ts).
//
// COLOURS: the presets are CSS classes (ec-notice--theme/info/warning/success,
// in styles/_ec-features.scss). "custom" sets --ec-notice-bg to the picked
// colour and --ec-notice-fg to black or white, whichever reads better
// (readableTextOn in colour.ts).
import { EC_CONFIG, EcNoticeBanner, currentLang, localised } from './ec-config';
import { isWithinSchedule } from './scheduled-content';
import { sanitizeHtml } from './sanitize';
import { readableTextOn } from './colour';
import { isKiosk } from './kiosk';

type Position = EcNoticeBanner['position'];
const POSITIONS: Position[] = ['top', 'belowMenu', 'belowSearch', 'bottom'];

/** Storage key prefix for dismissed banners (also in kiosk.ts' purge list). */
export const NOTICE_DISMISS_PREFIX = 'ec:notice:';

/** Icon per style (Material Symbols names; the font is loaded by our styles). */
const ICONS: Record<EcNoticeBanner['style'], string> = {
  theme: 'campaign', info: 'info', warning: 'warning', success: 'check_circle', custom: 'campaign',
};

/** NDE markers. Verified: main menu links (Oct 2026), nde-search-bar-container, .custom-search-bar-container. */
const SEL = {
  /** NDE's main menu (desktop). Starting point for finding the top bar. */
  menu: '[data-qa="main-menu_links"]',
  /** Fallbacks for the top bar when the menu is not there. Unverified, generic. */
  headerFallback: 'header, [role="banner"]',
  /** Elements that are PAGE CONTENT — the top bar never contains them. */
  content: 'nde-search-bar-container, .custom-search-bar-container, main, [role="main"], router-outlet, nde-search-results, nde-full-display-container, .main-landing-page',
  /** Home page: the banner area with the search box (Ex Libris' template class). */
  landingSearch: '.custom-search-bar-container',
  /** Results and record pages: NDE's search bar. */
  searchBar: 'nde-search-bar-container',
  /** Root of the NDE app — the last-resort place for top/belowMenu banners. */
  appRoot: 'nde-app-root',
} as const;

/** Re-check dates this often (ms) — a banner may start or end while the page is open. */
const RECHECK_MS = 60 * 1000;

/** One container per position, created on demand. */
const containers = new Map<Position, HTMLElement>();
/** Logged once: the top bar could not be found. */
let topBarWarned = false;

/** Start: build the banners, place them, keep them in place. Called once from bootstrap.ts. */
export function startNoticeBanners(): void {
  const cfg = EC_CONFIG.noticeBanners;
  // Console helper for checking the placement on a new NDE release.
  (window as any).ecNoticeBanners = { probe };
  if (!cfg?.enabled || !Array.isArray(cfg.banners) || cfg.banners.length === 0) return;

  const begin = () => {
    build();
    place();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; place(); });
    }).observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => { build(); place(); }, RECHECK_MS);
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
}

// ------------------------------------------------------------------ building

/** (Re)build the banners that should show now; empty containers are removed. */
function build(): void {
  const cfg = EC_CONFIG.noticeBanners!;
  const lang = currentLang();
  const wanted = new Map<Position, EcNoticeBanner[]>();
  for (const b of cfg.banners) {
    if (!b || typeof b !== 'object') continue;
    const html = b.text ? localised(b.text, lang) : '';
    if (!html || !html.replace(/<[^>]*>/g, '').trim()) continue; // no text in this language or English
    if (!isWithinSchedule(b.from, b.until)) continue;
    if (b.dismissible && isDismissed(b)) continue;
    const pos: Position = POSITIONS.includes(b.position) ? b.position : 'belowMenu';
    if (!wanted.has(pos)) wanted.set(pos, []);
    wanted.get(pos)!.push(b);
  }

  for (const pos of POSITIONS) {
    const list = wanted.get(pos) ?? [];
    const fingerprintList = list.map(fingerprint).join('|');
    let box = containers.get(pos);
    if (!list.length) {
      // Nothing (any more) for this position.
      box?.remove();
      containers.delete(pos);
      if (pos === 'bottom') updateBottomSpace();
      continue;
    }
    if (box && box.dataset['ecContent'] === fingerprintList) continue; // unchanged
    if (!box) {
      box = document.createElement('div');
      box.className = `ec-notices ec-notices--${pos}`;
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', localised(cfg.regionLabel, lang) || 'Notices');
      containers.set(pos, box);
    }
    box.dataset['ecContent'] = fingerprintList;
    box.replaceChildren(...list.map((b) => banner(b, lang)));
    if (pos === 'bottom') watchBottomHeight(box);
  }
}

/** The element for one banner. */
function banner(b: EcNoticeBanner, lang: string): HTMLElement {
  const style = (['theme', 'info', 'warning', 'success', 'custom'] as const).includes(b.style) ? b.style : 'theme';
  const el = document.createElement('div');
  el.className = `ec-notice ec-notice--${style}`;
  if (style === 'custom' && b.color) {
    el.style.setProperty('--ec-notice-bg', b.color);
    el.style.setProperty('--ec-notice-fg', readableTextOn(b.color));
  }

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined ec-notice__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[style];

  const text = document.createElement('div');
  text.className = 'ec-notice__text';
  text.innerHTML = sanitizeHtml(localised(b.text, lang)); // sanitised: see sanitize.ts

  el.append(icon, text);

  if (b.dismissible) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ec-notice__close';
    close.setAttribute('aria-label', localised(EC_CONFIG.noticeBanners!.closeLabel, lang) || 'Close');
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    close.addEventListener('click', () => {
      dismiss(b);
      build();
      place();
    });
    el.append(close);
  }
  return el;
}

// ---------------------------------------------------------------- placement

/** Put every container where it belongs (no DOM change when already there). */
function place(): void {
  const bar = topBar();
  for (const [pos, box] of containers) {
    if (pos === 'bottom') {
      // Directly in <body> (position: fixed, see the styles), not inside NDE's layout.
      if (box.parentElement !== document.body) document.body.appendChild(box);
      continue;
    }
    if (pos === 'top') {
      if (bar) putBefore(box, bar);
      else putFirst(box);
      continue;
    }
    if (pos === 'belowMenu') {
      if (bar) putAfter(box, bar);
      else putFirst(box, containers.get('top'));
      continue;
    }
    // belowSearch: after the search area; without one, under the menu banners.
    const search = searchArea();
    const below = containers.get('belowMenu');
    if (search) putAfter(box, search);
    else if (below?.isConnected) putAfter(box, below);
    else if (bar) putAfter(box, bar);
    else putFirst(box, containers.get('top') ?? undefined);
  }
}

function putBefore(box: HTMLElement, anchor: Element): void {
  if (anchor.previousElementSibling !== box) anchor.parentElement?.insertBefore(box, anchor);
}
function putAfter(box: HTMLElement, anchor: Element): void {
  if (anchor.nextElementSibling !== box) anchor.parentElement?.insertBefore(box, anchor.nextSibling);
}
/** Last resort: start of the NDE app (after `after`, when given and in place). */
function putFirst(box: HTMLElement, after?: HTMLElement): void {
  if (after?.isConnected) { putAfter(box, after); return; }
  const root = document.querySelector(SEL.appRoot) ?? document.body;
  if (root.firstElementChild !== box) root.insertBefore(box, root.firstChild);
}

/**
 * The top bar: the largest ancestor of NDE's main menu that does not contain
 * page content (search bar, results, home page …). null when there is no menu.
 */
function topBar(): Element | null {
  const menu = document.querySelector(SEL.menu);
  let el: Element | null = menu ? (menu.closest('nav') ?? menu) : null;
  if (!el || !isShown(el)) el = Array.from(document.querySelectorAll(SEL.headerFallback)).find((h) => isShown(h) && !h.closest('.ec-notices')) ?? null;
  if (!el) {
    if (!topBarWarned) {
      topBarWarned = true;
      console.info('[ec] notice banners: NDE main menu not found — "above/under the menu" banners are put at the top of the page.');
    }
    return null;
  }
  const root = document.querySelector(SEL.appRoot);
  while (el.parentElement && el.parentElement !== document.body && el.parentElement !== root
         && !el.parentElement.querySelector(SEL.content)) {
    el = el.parentElement;
  }
  return el;
}

/** The visible search area of this page, or null. */
function searchArea(): Element | null {
  const landing = document.querySelector(SEL.landingSearch);
  if (landing && isShown(landing)) return landing;
  const bar = document.querySelector(SEL.searchBar);
  return bar && isShown(bar) ? bar : null;
}

/** Rendered with a size (not display:none, not in a closed drawer). */
function isShown(el: Element): boolean {
  return el.getClientRects().length > 0 && (el as HTMLElement).offsetHeight > 0;
}

// ------------------------------------------------------------ bottom banners
//
// The bottom container is position: fixed (styles/_ec-features.scss), so it
// covers the end of the page. Its height goes into --ec-notices-bottom-h on
// <html>, and the class ec-has-bottom-notice gives <body> that much padding.

let bottomObserver: ResizeObserver | null = null;

function watchBottomHeight(box: HTMLElement): void {
  if (!bottomObserver && 'ResizeObserver' in window) {
    bottomObserver = new ResizeObserver(() => updateBottomSpace());
  }
  bottomObserver?.observe(box);
  updateBottomSpace();
}

function updateBottomSpace(): void {
  const box = containers.get('bottom');
  const html = document.documentElement;
  const h = box?.isConnected ? box.offsetHeight : 0;
  html.style.setProperty('--ec-notices-bottom-h', `${h}px`);
  html.classList.toggle('ec-has-bottom-notice', h > 0);
}

// ---------------------------------------------------------------- dismissing

/** Short stable hash of the banner's content: any edit gives a new value. */
function fingerprint(b: EcNoticeBanner): string {
  const s = JSON.stringify([b.text, b.from, b.until, b.position, b.style, b.color]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; // djb2
  return (h >>> 0).toString(36);
}

/** Where dismissals live: sessionStorage on reading room PCs, else localStorage. */
function store(): Storage | null {
  try { return isKiosk() ? sessionStorage : localStorage; } catch { return null; }
}

/** Dismissed during this page view — also covers browsers that block storage. */
const hiddenThisPage = new Set<string>();

function isDismissed(b: EcNoticeBanner): boolean {
  const key = fingerprint(b);
  if (hiddenThisPage.has(key)) return true;
  try { return store()?.getItem(NOTICE_DISMISS_PREFIX + key) === '1'; } catch { return false; }
}

function dismiss(b: EcNoticeBanner): void {
  const key = fingerprint(b);
  hiddenThisPage.add(key);
  try { store()?.setItem(NOTICE_DISMISS_PREFIX + key, '1'); } catch { /* storage blocked: hidden until the next page load */ }
}

// -------------------------------------------------------------------- probe

/** `ecNoticeBanners.probe()` in the console: what the placement code found. */
function probe(): void {
  console.info('[ec] notice banners probe', {
    enabled: !!EC_CONFIG.noticeBanners?.enabled,
    banners: EC_CONFIG.noticeBanners?.banners?.length ?? 0,
    menu: document.querySelector(SEL.menu),
    topBar: topBar(),
    searchArea: searchArea(),
    placed: Object.fromEntries([...containers].map(([pos, box]) => [pos, box.isConnected ? box.parentElement : 'not in page'])),
  });
}
