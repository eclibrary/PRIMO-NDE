// src/app/shared/components/ec-last-search/ec-last-search.component.ts
//
// "Pick up where you left off": remembers the last results page the patron
// visited (full URL, so query, scope, facets and paging all come back) and
// exposes it to the static landing page.
//
// STORAGE: localStorage — must survive the browser session. One entry per
// view (key `ec:lastSearch:<vid>`) so Find-eR and PUBS don't swap searches.
// Entries older than EC_CONFIG.lastSearch.maxAgeDays are ignored and removed.
// Nothing personal is stored: only the search URL the patron already typed.
//
// HOW IT'S FED: by watching the address bar. NDE updates paging, facets and
// sort with history.replaceState — no router event fires — so a router
// subscription would keep the offset the patron arrived with. Instead we
// check location on popstate/pagehide and on a 1 s poll (negligible cost).
// A URL is recorded when its path matches `resultsPath` (/search) and carries
// a `query` param, i.e. a real search rather than the empty results route.
// Dev-only params are stripped before saving.
//
// HOW IT'S SHOWN: the landing page HTML contains a block marked
//   <div data-ec-last-search> … <a data-ec-last-search-link>
//        … <span data-ec-last-search-terms></span> … </a> … </div>
// This component keeps `ec-has-last-search` on <html> (CSS in
// _shared-theme.scss shows/hides the block), fills the anchor's href and the
// terms span whenever the landing page renders, and handles clicks via the
// shell router so the navigation stays in-app.
// Optional: an element marked `data-ec-last-search-page` receives the page
// indication, e.g. "(page 4)" (setting lastSearch.pageLabel); it stays empty
// on page 1.
//
// PAGE NUMBER: the results URL has no page number, only `offset` (offset=30 =
// page 4 at 10 per page) and it does NOT say how many results a page holds.
// So: page = offset / pageSize + 1, where pageSize is learned from the screen
// by counting the rendered result rows (learnPageSize) and remembered with the
// stored search. Until a count is available, lastSearch.defaultPageSize (10).
//
// LAST VIEWED RECORD: when the patron opens a record (address bar goes to
// `fullDisplayPath` with a `docid`), that id is stored with the search. Back
// on the results page the matching row gets a "Last viewed" label
// (markLastViewed), and when the patron arrives through the landing-page link
// the list also scrolls to that row, once. The record is remembered for the
// results page it was opened from; paging on or starting another search drops it.
// The label's CSS lives in this component (`styles`, un-encapsulated) because
// the label is inserted into NDE's own markup.
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
import { Component, OnDestroy, Renderer2, ViewEncapsulation, inject } from '@angular/core';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { EC_CONFIG, currentVid, localised } from '../../ec-config';
import { isKiosk } from '../../kiosk';

/** What we persist. Keep it small and self-describing for future readers of localStorage. */
interface LastSearch {
  /** Path + query relative to the /nde base, e.g. "/search?query=any,contains,x&vid=…&offset=10". */
  url: string;
  /** Human-readable search terms, for the link label. */
  terms: string;
  /** Epoch ms when it was saved — for expiry. */
  savedAt: number;
  /**
   * Results per page in force when the search was saved — needed to turn the
   * URL's `offset` into a page number. Absent on entries saved by older builds.
   */
  pageSize?: number;
  /**
   * Record id (PNX recordid, e.g. "alma996846513804061") of the record last
   * opened from this results page. Dropped when `url` changes.
   */
  lastRecordId?: string;
}

/**
 * sessionStorage flag: "the patron just clicked the landing-page link — scroll
 * to the last viewed record when the list is there". sessionStorage (not a
 * field) so it also survives the full-page fallback navigation in handleClick.
 */
const SCROLL_FLAG = 'ec:lastSearch:scrollToLastViewed';
/** Class of the label we insert; also used to find and remove it again. */
const LAST_VIEWED_CLASS = 'ec-last-viewed';

/** One result row in the results list; counted to learn the page size. */
const RESULT_ROW = 'nde-search-result-item-container';

@Component({
  selector: 'custom-ec-last-search',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-last-search' },
  template: '', // headless — see header comment
  // Styles for the "Last viewed" label this component inserts into NDE's result
  // rows. None = global CSS: emulated encapsulation only reaches elements of
  // our own template, and this label is created with DOM calls inside NDE's.
  encapsulation: ViewEncapsulation.None,
  styles: [`
    /* Sits in the record's top line (a flex row): JOURNAL | PEER REVIEWED | … | LAST VIEWED.
       order 2 = after NDE's own entries (0) and the Library on the Go badge (1). */
    .ec-last-viewed {
      order: 2;
      display: inline-flex;
      align-items: center;
      gap: .25rem;
      align-self: center;
      margin-left: .75rem;
      padding: .0625rem .5rem;
      border: 1px solid var(--ec-blue, #004494);
      border-radius: 1rem;
      color: var(--ec-blue, #004494);
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    /* Beats the global 28px .material-symbols-outlined rule in _shared-theme.scss. */
    .ec-last-viewed .material-symbols-outlined {
      font-size: 1rem;
      line-height: 1;
      margin: 0;
      color: inherit;
    }
  `],
})
export class EcLastSearchComponent implements OnDestroy {
  private readonly router = inject(SHELL_ROUTER);
  private readonly renderer = inject(Renderer2);

  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);
  /** Pending timers used to (re)apply the link after the async landing page render. */
  private timers: number[] = [];
  /** Last address-bar value we processed; avoids re-saving identical URLs every poll. */
  private lastSeenUrl = '';
  private readonly checkUrl = () => {
    const now = window.location.pathname + window.location.search;
    if (now !== this.lastSeenUrl) {
      this.lastSeenUrl = now;
      this.onUrl(now);
    } else {
      // Same URL as a second ago: the results have had time to render, so this
      // is the moment to count them and to label the last viewed record
      // (both are no-ops off the results page).
      this.learnPageSize();
      this.markLastViewed();
    }
  };
  private poll = 0;

  constructor() {
    this.checkUrl(); // initial URL: a deep link straight onto results counts too
    window.addEventListener('popstate', this.checkUrl);
    window.addEventListener('pagehide', this.checkUrl); // leaving the tab: catch the very last state
    this.poll = window.setInterval(this.checkUrl, 1000);

    document.body.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.checkUrl);
    window.removeEventListener('pagehide', this.checkUrl);
    window.clearInterval(this.poll);
    document.body.removeEventListener('click', this.onClick, true);
    this.timers.forEach((t) => window.clearTimeout(t));
  }

  // -------------------------------------------------------------- recording

  /**
   * Called for every distinct address-bar value. `url` is absolute-from-origin
   * ("/nde/search?…"); it is normalised to the router-relative form
   * ("/search?…") before matching and storing.
   */
  private onUrl(url: string): void {
    const cfg = EC_CONFIG.lastSearch;
    const relative = url.replace(/^\/nde(?=\/)/, ''); // "/nde/search?…" → "/search?…"
    const [path, qs = ''] = relative.split('?');
    const params = new URLSearchParams(qs);

    if (path === cfg.resultsPath && params.has('query')) {
      for (const p of cfg.stripParams) params.delete(p);
      const previous = this.load();
      const newUrl = `${path}?${params.toString()}`;
      this.save({
        url: newUrl,
        terms: this.termsOf(params),
        savedAt: Date.now(),
        // Carry the page size we knew for the previous page of this session;
        // learnPageSize() corrects it once the new page has rendered.
        pageSize: previous?.pageSize,
        // The last viewed record belongs to the results page it was opened
        // from: keep it when we are back on that same page, drop it otherwise.
        lastRecordId: previous?.url === newUrl ? previous.lastRecordId : undefined,
      });
    }

    // A record was opened: remember which one (see LAST VIEWED RECORD above).
    // Covers every way of opening it — title, thumbnail, availability button.
    if (path === cfg.fullDisplayPath) {
      const docid = params.get('docid');
      const entry = this.load();
      if (docid && entry && entry.lastRecordId !== docid) this.save({ ...entry, lastRecordId: docid });
    }

    // Whether we just saved or not, (re)apply the link on the landing page:
    // its static HTML renders asynchronously after navigation, so try a few times.
    this.reflect();
    if (path === cfg.homePath) {
      this.timers.forEach((t) => window.clearTimeout(t));
      this.timers = [300, 1000, 2500].map((ms) => window.setTimeout(() => this.reflect(), ms));
    }
  }

  /**
   * Readable terms for the link label; several `query` params are joined.
   * NDE writes `query=europe` for a simple search. Advanced search (and VE-style
   * deep links) use `field,precision,terms[,OPERATOR]`, with the lines of an
   * advanced search joined by ";" in ONE parameter, e.g.
   *     any,contains,god is not great,AND;any,exact,religion
   * → "god is not great · religion". Only the terms of each line are kept; the
   * field, precision and the AND/OR/NOT that links a line to the next are dropped.
   */
  private termsOf(params: URLSearchParams): string {
    return termsOfQueries(params.getAll('query'));
  }

  // ------------------------------------------------------------ page number

  /**
   * Learn how many results a page holds by counting the rows on screen, and
   * store it with the current entry. Called by the 1 s poll while the URL is
   * unchanged. The count is only trusted when it cannot be a short LAST page:
   *   - on the first page (offset 0) a page is full unless the search has fewer
   *     results than a page — and then there is no page 2 to label anyway;
   *   - further on, only a count that is LARGER than the size known so far and
   *     divides the offset evenly (a page start is always a multiple of the
   *     page size). A smaller count there is most likely the last page.
   */
  private learnPageSize(): void {
    const relative = this.lastSeenUrl.replace(/^\/nde(?=\/)/, '');
    const [path, qs = ''] = relative.split('?');
    if (path !== EC_CONFIG.lastSearch.resultsPath) return;

    const entry = this.load();
    const rows = document.querySelectorAll(RESULT_ROW).length;
    if (!entry || rows === 0) return;

    const offset = offsetOf(new URLSearchParams(qs));
    const known = entry.pageSize ?? EC_CONFIG.lastSearch.defaultPageSize;
    // Page 1: trust the count, but never go below the default (a search with
    // only 7 results still has 10 per page). Later pages: see the rule above.
    const trusted = offset === 0 || (rows > known && offset % rows === 0);
    const size = offset === 0 ? Math.max(rows, EC_CONFIG.lastSearch.defaultPageSize) : rows;
    if (trusted && size !== entry.pageSize) this.save({ ...entry, pageSize: size });
  }

  /** 1-based page number of a stored search (1 when the URL has no offset). */
  private pageOf(entry: LastSearch): number {
    const offset = offsetOf(new URLSearchParams(entry.url.split('?')[1] ?? ''));
    const size = entry.pageSize || EC_CONFIG.lastSearch.defaultPageSize;
    return Math.floor(offset / size) + 1;
  }

  // ------------------------------------------------------------ last viewed

  /**
   * On the results page: put the "Last viewed" label on the row of the stored
   * record (and remove it from any other row), and scroll to it once when the
   * patron came in through the landing-page link. Called by the 1 s poll, so it
   * also catches rows NDE renders late; it does nothing when all is in place.
   *
   * A row is found through its title link, which NDE renders as
   * <a id="record_id_<recordid>">; the label goes at the end of the row's top
   * line (the flex row holding nde-record-type), like the Library on the Go badge.
   */
  private markLastViewed(): void {
    const cfg = EC_CONFIG.lastSearch;
    const text = localised(cfg.lastViewedLabel);
    const relative = this.lastSeenUrl.replace(/^\/nde(?=\/)/, '');
    if (!text || relative.split('?')[0] !== cfg.resultsPath) return;

    const id = this.load()?.lastRecordId;
    // CSS.escape: record ids are plain today, but never build a selector from raw data.
    const anchor = id ? document.querySelector(`a[id="record_id_${CSS.escape(id)}"]`) : null;
    const row = anchor?.closest(RESULT_ROW) ?? null;

    // Remove labels from rows that are no longer the last viewed one.
    document.querySelectorAll(`.${LAST_VIEWED_CLASS}`).forEach((label) => {
      if (!row || !row.contains(label)) label.remove();
    });
    if (!row) return;

    if (!row.querySelector(`.${LAST_VIEWED_CLASS}`)) {
      const line = row.querySelector('nde-record-type')?.parentElement;
      if (!line) return;
      const label = this.renderer.createElement('span') as HTMLElement;
      label.className = LAST_VIEWED_CLASS;
      const icon = this.renderer.createElement('span') as HTMLElement;
      icon.className = 'material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'history'; // Material Symbols icon name
      label.append(icon, text);
      line.appendChild(label);
    }

    // Scroll once, only after a click on the landing-page link (flag set there).
    if (takeScrollFlag()) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // --------------------------------------------------------------- storage

  private get storageKey(): string {
    return `${EC_CONFIG.lastSearch.storageKeyPrefix}${currentVid()}`;
  }

  // KIOSK (reading room PCs, see kiosk.ts): nothing is stored and nothing is
  // read back, so the landing page never shows a previous visitor's search.
  // Everything goes through save()/load(), so these two checks cover the feature.
  private save(entry: LastSearch): void {
    if (isKiosk()) return;
    try { localStorage.setItem(this.storageKey, JSON.stringify(entry)); } catch { /* quota/private mode: ignore */ }
  }

  /** Stored entry, or null when absent, malformed, or expired (expired ones are removed). */
  load(): LastSearch | null {
    if (isKiosk()) return null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as LastSearch;
      const maxAge = EC_CONFIG.lastSearch.maxAgeDays * 86_400_000;
      if (!entry?.url || Date.now() - (entry.savedAt ?? 0) > maxAge) {
        localStorage.removeItem(this.storageKey);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- display

  /** Toggle the <html> class and fill any landing-page markup that is present. */
  private reflect(): void {
    const entry = this.load();
    const html = document.documentElement;
    if (entry) this.renderer.addClass(html, 'ec-has-last-search');
    else this.renderer.removeClass(html, 'ec-has-last-search');

    document.querySelectorAll<HTMLAnchorElement>('a[data-ec-last-search-link]').forEach((a) => {
      // Real href so middle-click / copy-link work; click is handled in-app below.
      a.href = entry ? `/nde${entry.url}` : '#';
    });
    // Terms are re-derived from the stored URL, so entries saved before the
    // advanced-search fix (Oct 2026) display cleanly too; stored `terms` is the fallback.
    const terms = entry ? (termsOfQueries(new URLSearchParams(entry.url.split('?')[1] ?? '').getAll('query')) || entry.terms) : '';
    document.querySelectorAll<HTMLElement>('[data-ec-last-search-terms]').forEach((el) => {
      el.textContent = terms;
    });
    // "(page 4)" — only beyond the first page; empty otherwise so nothing shows.
    const page = entry ? this.pageOf(entry) : 1;
    const pageText = page > 1 ? localised(EC_CONFIG.lastSearch.pageLabel).replace('{n}', String(page)) : '';
    document.querySelectorAll<HTMLElement>('[data-ec-last-search-page]').forEach((el) => {
      el.textContent = pageText;
    });
  }

  /** In-app navigation for the landing-page link (keeps the SPA state, no reload). */
  private handleClick(ev: MouseEvent): void {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const anchor = (ev.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-ec-last-search-link]');
    if (!anchor) return;
    const entry = this.load();
    if (!entry) return;
    ev.preventDefault();
    ev.stopPropagation();
    // Ask markLastViewed() to scroll to the last viewed record once the list is there.
    try { sessionStorage.setItem(SCROLL_FLAG, String(Date.now())); } catch { /* no storage: no scroll */ }
    try {
      this.router.navigateByUrl(entry.url);
    } catch {
      window.location.assign(`/nde${entry.url}`);
    }
  }
}

/** The `offset` query parameter as a non-negative integer (0 when absent or invalid). */
function offsetOf(params: URLSearchParams): number {
  const n = Number.parseInt(params.get('offset') ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Consume the "scroll to last viewed" flag: true once after a click on the
 * landing-page link, provided the click was recent. The age limit keeps a flag
 * that was never consumed (the record was not on the page) from causing a
 * surprise scroll much later in the session.
 */
function takeScrollFlag(): boolean {
  try {
    const setAt = Number(sessionStorage.getItem(SCROLL_FLAG));
    if (!setAt) return false;
    sessionStorage.removeItem(SCROLL_FLAG);
    return Date.now() - setAt < 30_000;
  } catch {
    return false;
  }
}

/** Operators that link one advanced-search line to the next. */
const QUERY_OPERATORS = new Set(['AND', 'OR', 'NOT']);

/**
 * Readable terms from one or more `query` values (see termsOf for the formats).
 * Lines and parameters are joined with " · "; empty pieces are dropped.
 */
function termsOfQueries(queries: string[]): string {
  const pieces: string[] = [];
  for (const q of queries) {
    if (!q.includes(',')) { pieces.push(q.trim()); continue; } // simple NDE search
    for (const line of q.split(';')) {
      const parts = line.split(',');
      if (parts.length < 3) { pieces.push(line.trim()); continue; }
      let terms = parts.slice(2); // drop field + precision; terms may contain commas
      if (terms.length > 1 && QUERY_OPERATORS.has(terms[terms.length - 1].trim())) terms = terms.slice(0, -1);
      pieces.push(terms.join(',').trim());
    }
  }
  return pieces.filter(Boolean).join(' · ');
}
