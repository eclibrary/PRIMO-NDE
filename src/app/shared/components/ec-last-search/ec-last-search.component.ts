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
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
import { Component, OnDestroy, Renderer2, inject } from '@angular/core';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { EC_CONFIG, currentVid } from '../../ec-config';

/** What we persist. Keep it small and self-describing for future readers of localStorage. */
interface LastSearch {
  /** Path + query relative to the /nde base, e.g. "/search?query=any,contains,x&vid=…&offset=10". */
  url: string;
  /** Human-readable search terms, for the link label. */
  terms: string;
  /** Epoch ms when it was saved — for expiry. */
  savedAt: number;
}

@Component({
  selector: 'custom-ec-last-search',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-last-search' },
  template: '', // headless — see header comment
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
      this.save({ url: `${path}?${params.toString()}`, terms: this.termsOf(params), savedAt: Date.now() });
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
   * NDE writes `query=europe`; the VE-style `query=any,contains,europe` also
   * occurs (advanced search, deep links) — keep only the terms in either form.
   */
  private termsOf(params: URLSearchParams): string {
    return params.getAll('query')
      .map((q) => (q.includes(',') ? q.split(',').slice(2).join(',') : q).trim())
      .filter(Boolean)
      .join(' ; ');
  }

  // --------------------------------------------------------------- storage

  private get storageKey(): string {
    return `${EC_CONFIG.lastSearch.storageKeyPrefix}${currentVid()}`;
  }

  private save(entry: LastSearch): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify(entry)); } catch { /* quota/private mode: ignore */ }
  }

  /** Stored entry, or null when absent, malformed, or expired (expired ones are removed). */
  load(): LastSearch | null {
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
    document.querySelectorAll<HTMLElement>('[data-ec-last-search-terms]').forEach((el) => {
      el.textContent = entry?.terms ?? '';
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
    try {
      this.router.navigateByUrl(entry.url);
    } catch {
      window.location.assign(`/nde${entry.url}`);
    }
  }
}
