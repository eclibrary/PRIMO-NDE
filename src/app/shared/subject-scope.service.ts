// src/app/shared/subject-scope.service.ts
//
// "Subject scope": keeps one facet (e.g. the country picked on the Country
// Knowledge landing page) applied to EVERY following search, until the user
// removes it.
//
// WHY THIS EXISTS
// Primo VE kept such a facet with a ",lk" (locked) suffix in the URL. NDE does
// not: its padlock lives in session state and never appears in the URL, and a
// ",lk" suffix is read as part of the facet value (→ zero results). Since we
// cannot lock a facet through the URL, we re-apply it ourselves.
//
// HOW IT WORKS
// 1. A landing-page tile carries the facet to keep:
//        <a data-ec-nav="search" data-ec-query="query=Belgium&mfacet=topic,include,Belgium…"
//           data-ec-scope="topic,include,Belgium" data-ec-scope-label="Belgium">
//    EcSessionComponent calls set() on click (before navigating).
// 2. On every completed navigation to the results page we compare the URL with
//    the stored scope (facets are read from both `mfacet` and `facet`):
//      - facet present → fine; remember the query AND the other facets.
//      - facet missing, same query, other facets UNCHANGED
//            → only our facet went away: the user removed it on purpose
//              (its × in NDE's active filters) → scope ends.
//      - facet missing, anything else changed (new query, or other filters
//        added/removed in the same query)
//            → NDE rebuilt the URL without it → re-navigate (replaceUrl) to the
//              same URL plus the scope facet.
//    Why the second rule matters: when the user picks another filter, NDE builds
//    the new URL from its own filter state, which does not include our facet
//    (in the panel our country even shows as unchecked). Treating that as
//    "removed by the user" was what made the scope disappear (fixed Oct 2026).
//    The chip's × remains the explicit way to end the scope.
// 3. Landing on the home page ends the scope, so going "home" means a fresh start.
//
// WHICH URL CHANGES ARE SEEN
// Not every NDE action is a router navigation: some (paging, at least, and
// apparently some filter changes) rewrite the address bar with
// history.replaceState/pushState and emit NO router event. Missing those made
// the scope silently drop out until a page reload re-checked the URL. So the
// URL is checked on three triggers, de-duplicated by the URL itself:
//   - router NavigationEnd events,
//   - history.pushState / history.replaceState (wrapped once, see watchHistory),
//   - popstate (Back/Forward).
//
// The scope lives in sessionStorage (per tab, per view), so it survives reloads
// but not a new tab or a new browser session.
//
// The stored label, flag image, seed query and key are for the visual cues
// (EcScopeChipComponent in the search bar, EcScopeLinksComponent above the
// results); the re-applying logic only needs `facet`.
import { Injectable, inject } from '@angular/core';
import { EventType, NavigationEnd } from '@angular/router';
import { SHELL_ROUTER } from '../injection-tokens';

/**
 * URL parameter NDE uses for facets: `mfacet=topic,include,Belgium`.
 * (Primo VE used `facet=…`; NDE does not treat that the same way and returned
 * far fewer results — verified Oct 2026.)
 */
export const FACET_PARAM = 'mfacet';

/**
 * True when URL facet value `value` is the scope facet `facet`. Also accepts
 * extra trailing parts NDE might append (VE wrote e.g. "topic,include,Brazil,1,lk"),
 * so a suffix never makes us think the facet is gone.
 */
export function isScopeFacet(value: string, facet: string): boolean {
  return value === facet || value.startsWith(`${facet},`);
}

/** What we keep in sessionStorage while a scope is active. */
export interface SubjectScope {
  /** Facet exactly as it appears (decoded) in NDE's `mfacet` URL parameter, e.g. "topic,include,Belgium". */
  facet: string;
  /** Human label for the chip, e.g. "Belgium". */
  label: string;
  /** Absolute URL of the flag/icon shown in the chip, if the tile had one. */
  image?: string;
  /** Query the tile searched for ("Belgium"); EcScopeChipComponent blanks it from the input. */
  seedQuery?: string;
  /** Short id of the scope, e.g. ISO code "be"; EcScopeLinksComponent looks up its links by it. */
  key?: string;
  /** Query of the last results page that had the facet; used to tell "filter removed" from "new search". */
  lastQuery?: string;
  /** The OTHER facets (sorted) on that page; used to tell "user removed ours" from "NDE dropped ours". */
  lastOtherFacets?: string[];
}

@Injectable({ providedIn: 'root' })
export class SubjectScopeService {
  /** The NDE shell's Angular router (documented injection token). */
  private readonly router = inject(SHELL_ROUTER);
  /**
   * Seed query ("Belgium") of the scope that just ended. NDE keeps the last
   * query in its search box, so after a scope ends (e.g. by going Home) the box
   * would still say "Belgium"; EcScopeChipComponent uses this to clear it.
   * In memory only — it concerns the current page session, nothing to persist.
   */
  endedSeedQuery?: string;

  /** Guard so start() wires the router listener only once per page. */
  private started = false;
  /** Last URL (path + query) checked, so the same change isn't handled twice. */
  private lastChecked?: string;
  /**
   * Normalised URL we last re-added the facet to. If NDE produces that exact
   * URL again (facet dropped once more), it refuses the facet → give up instead
   * of navigating in a loop.
   */
  private reappliedFrom?: string;

  /**
   * Forget which URL we last re-added the facet to. MUST happen whenever a
   * scope ends or a new one starts: the guard compares URLs without our facet,
   * so a search for the same words in the next scope (e.g. "energy" after
   * Home → another flag) produced the very same URL, looked like "NDE refused
   * the facet again" and ended the new scope at once. Bug found Oct 2026 via:
   * flag → search → Home → flag → same search.
   */
  private resetLoopGuard(): void {
    this.reappliedFrom = undefined;
  }

  /** sessionStorage key, per view so scopes never leak between views. */
  private key(): string {
    const vid = new URLSearchParams(window.location.search).get('vid') ?? 'default';
    return `ec-subject-scope:${vid}`;
  }

  /** Current scope, or null when none is active (or storage is unavailable/corrupt). */
  get(): SubjectScope | null {
    try {
      const raw = sessionStorage.getItem(this.key());
      return raw ? (JSON.parse(raw) as SubjectScope) : null;
    } catch {
      return null;
    }
  }

  /** Start a new scope (replaces any previous one). */
  set(scope: SubjectScope): void {
    // A brand-new scope (from a tile: no lastQuery yet) starts with a clean
    // slate — including the loop guard, see resetLoopGuard().
    if (scope.lastQuery === undefined) {
      this.endedSeedQuery = undefined;
      this.resetLoopGuard();
    }
    try {
      sessionStorage.setItem(this.key(), JSON.stringify(scope));
    } catch {
      /* storage blocked (privacy mode) — the first search still has the facet */
    }
  }

  /**
   * The scope, but only while it is visibly in effect: on the results page AND
   * with its facet in the URL. The visual cues (chip, links strip) use this so
   * they never show for a scope the current page doesn't apply.
   */
  activeOnResults(): SubjectScope | null {
    if (!window.location.pathname.endsWith('/search')) return null;
    const scope = this.get();
    if (!scope) return null;
    const facets = new URLSearchParams(window.location.search).getAll(FACET_PARAM);
    return facets.some((f) => isScopeFacet(f, scope.facet)) ? scope : null;
  }

  /** End the scope. */
  clear(): void {
    this.resetLoopGuard();
    // Remember what the ended scope put in the search box (see endedSeedQuery).
    const ending = this.get();
    if (ending?.seedQuery) this.endedSeedQuery = ending.seedQuery;
    try {
      sessionStorage.removeItem(this.key());
    } catch {
      /* nothing to clear */
    }
  }

  /**
   * Begin watching navigations. Called by EcSessionComponent; safe to call more
   * than once. The subscription lives as long as the page (the shell router
   * never goes away), so there is nothing to unsubscribe.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.router.events.subscribe((e) => {
      // Compare the numeric event type rather than `instanceof`, which can fail
      // when the shell and this bundle resolve different @angular/router copies.
      if ((e as { type?: number }).type !== EventType.NavigationEnd) return;
      this.check((e as NavigationEnd).urlAfterRedirects);
    });

    // URL changes that bypass the router (see header: WHICH URL CHANGES ARE SEEN).
    watchHistory(() => this.check(currentRouterUrl()));
    window.addEventListener('popstate', () => this.check(currentRouterUrl()));

    // The results page may already be showing when we start (deep link / reload).
    this.check(this.router.url);
  }

  /**
   * Run onNavigated() once per distinct URL, whatever triggered it. URLs are
   * compared in normalised form (parameter order, encoding and `offset`
   * ignored): the router and the address bar can spell the same URL
   * differently, and handling one change twice would trip the loop guard in
   * onNavigated() while our own re-navigation is still in flight.
   */
  private check(url: string): void {
    const [path, search = ''] = url.split('?');
    const key = `${path}?${normalise(new URLSearchParams(search))}`;
    if (key === this.lastChecked) return;
    this.lastChecked = key;
    this.onNavigated(url);
  }

  /** Apply the rules from the header comment to one completed navigation. */
  private onNavigated(url: string): void {
    const scope = this.get();
    if (!scope) return;

    // Router URLs are relative to the /nde base: "/search?…", "/home?…".
    const [path, search = ''] = url.split('?');

    if (path === '/home') {
      this.clear(); // back to the landing page = fresh start
      return;
    }
    if (path !== '/search') return; // full record, account… — leave the scope alone

    const params = new URLSearchParams(search);
    const query = params.get('query') ?? '';
    // NDE writes facets as `mfacet`, but derived links (e.g. FRBR) use `facet`:
    // look at both so we never miss ours or miscount the others.
    const allFacets = [...params.getAll(FACET_PARAM), ...params.getAll('facet')];
    const hasScope = allFacets.some((f) => isScopeFacet(f, scope.facet));
    const others = allFacets.filter((f) => !isScopeFacet(f, scope.facet)).sort();

    // Facet still applied → remember this page's query and other facets.
    if (hasScope) {
      if (scope.lastQuery !== query || !sameList(scope.lastOtherFacets, others)) {
        this.set({ ...scope, lastQuery: query, lastOtherFacets: others });
      }
      return;
    }

    // Same query, nothing else changed, only our facet gone → removed on purpose.
    if (scope.lastQuery === query && sameList(scope.lastOtherFacets, others)) {
      this.clear();
      return;
    }

    // Safety net: we already re-added the facet to exactly this URL and it is
    // missing again, so NDE refuses it — give up instead of looping.
    const normalised = normalise(params);
    if (this.reappliedFrom === normalised) {
      this.clear();
      return;
    }

    // New search, or filters changed → add it back, replacing the history entry
    // so Back doesn't land on the unscoped result list.
    this.reappliedFrom = normalised;
    params.append(FACET_PARAM, scope.facet);
    this.router.navigateByUrl(`/search?${params.toString()}`, { replaceUrl: true });
  }
}

/** Same items in the same order (both lists are sorted by the caller). Missing = empty. */
function sameList(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const left = a ?? [];
  return left.length === b.length && left.every((v, i) => v === b[i]);
}

/** Order-independent form of a query string, ignoring paging (`offset`). */
function normalise(params: URLSearchParams): string {
  // forEach rather than entries(): the project's tsconfig has no "dom.iterable".
  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k !== 'offset') pairs.push(`${k}=${v}`);
  });
  return pairs.sort().join('&');
}

/** The address bar as a router URL (relative to the /nde base): "/search?…". */
function currentRouterUrl(): string {
  const path = window.location.pathname.replace(/^\/nde(?=\/)/, '');
  return path + window.location.search;
}

/**
 * Call `onChange` after every history.pushState / history.replaceState, i.e.
 * also for URL updates NDE makes without a router navigation. The originals
 * still run first and unchanged; the callback is deferred a microtask so the
 * new URL is in place and the caller's own code has finished. Wrapped once per
 * page (a marker on `history` prevents double-wrapping).
 */
function watchHistory(onChange: () => void): void {
  const h = history as History & { __ecScopeWatched?: boolean };
  if (h.__ecScopeWatched) return;
  h.__ecScopeWatched = true;

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = h[method].bind(h);
    h[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      queueMicrotask(onChange);
    };
  }
}
