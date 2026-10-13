// src/app/shared/components/ec-account-counts/ec-account-counts.component.ts
//
// "Your account at a glance" on the landing page — headless.
//
// WHAT: a row of up to three links on the landing page, e.g.
//     [menu_book] 2 loans    [push_pin] 37 saved records    [saved_search] 1 saved search
// each opening the matching page of the library card:
//     loans          → /nde/account/loans
//     saved records  → /nde/account/favorites
//     saved searches → /nde/account/savedSearches
// (vid and lang of the current page are carried over by EcSessionComponent's
// data-ec-nav handling, so the same markup works in every language.)
// An item whose count is 0 is left out; with all three at 0 the row is hidden.
//
// GUESTS SEE IT TOO: every time a signed-in patron opens the landing page the
// fresh counts are written to localStorage (per view). When the visitor comes
// back signed out, those remembered counts are shown, so the patron sees at
// once that there is something waiting behind the sign-in. Clicking a link as a
// guest opens the account page, where NDE asks them to sign in first.
// Decision (Björn, Oct 2026): no "as of your last visit" note — counts only
// change through Find-eR, so the remembered numbers are normally current.
// (Known exception: a loan returned at the desk or by the book drop lowers the
// real loan count without a Find-eR visit; the next signed-in visit fixes it.)
//
// SHARED PCs: the stored counts carry a short hash of the patron id (never the
// id itself). While a signed-in patron's own counts are being fetched, stored
// counts are only shown if they belong to that same patron — so the next
// person signing in on a shared PC never sees someone else's numbers, not even
// for a split second. Guests see whatever was stored last (that is the point
// of the feature; it is only three numbers, no titles).
//
// HOW IT'S SHOWN: like EcLoansDueComponent, this component renders nothing in
// its own slot; it builds the links inside a container that sits in the static
// landing page HTML:
//
//     <nav class="ec-account-counts" data-ec-account-counts></nav>
//
//   - Above the links the component puts a "Welcome back" line
//     (<p class="ec-account-counts__welcome">, text: setting
//     accountCounts.welcomeLabel), unless the container carries
//     data-ec-account-counts-welcome="off" — Find-eR sets that on the signed-in
//     block, whose heading already says "Welcome back".
//   - The container gets class `ec-account-counts--show` when at least one
//     count is above 0 (CSS in homepage.css hides it otherwise).
//   - Its content is rebuilt from code (createElement/textContent — never
//     innerHTML), so the HTML file only needs the empty container.
//   - Put it in every block that can be visible: Find-eR has it in the guest
//     welcome, the user welcome AND the "Pick up where you left off" block,
//     because only one of those three is shown at a time.
//
// WHERE THE DATA COMES FROM: the endpoints NDE's own library card calls, with
// the session JWT as Bearer token (settings accountCounts.*Endpoint):
//   loans           /primaws/rest/priv/myaccount/loans?type=active&…&patron_id=<id>
//                   → data.loans.loan.length
//   saved records   /primaws/rest/priv/favorites?lang=…&vid=…
//                   → totalItems
//   saved searches  /primaws/rest/priv/savedSearches?inst_code=…&patron_id=<id>&…
//                   → queriesCount (fallback: searchesList.length)
// Each request fails independently: a failed one keeps that patron's previously
// stored number (or hides the item if there is none); the others still update.
//
// WHEN IT FETCHES: only when the patron is signed in AND the container is on
// the page, once per landing-page render (NDE re-creates the landing page HTML
// each time the patron navigates back to it, so coming back from the favorites
// page after removing a record shows the new number) and again after a
// sign-in. Never on results or record pages. Three small requests per visit.
//
// TESTING WITHOUT ACTIVE LOANS: setting accountCounts.testWithPastLoans counts
// the loan HISTORY instead of the active loans. NEVER leave that on in
// production — patrons would be told they have loans they returned long ago.
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
// ONLY FIND-eR: switched on in config/views/finder.json (global default off),
// and only Find-eR's homepage HTML contains the container.
import { Component, OnDestroy, effect, inject } from '@angular/core';
import { AuthStateService } from '../../auth-state.service';
import { EC_CONFIG, currentLang, currentVid, localised } from '../../ec-config';
import { UserInfoService } from '../../user-info.service';

/** Section may be missing from an older generated config → feature off, no crash. */
const CONFIG = EC_CONFIG.accountCounts;

/** How often the page is checked for the container (ms). The check itself is one querySelectorAll. */
const POLL_MS = 1500;
/** Marker attribute on a container this component has already scheduled a fetch for. */
const SEEN_ATTR = 'data-ec-account-counts-seen';

/** The three things that are counted; also the order in which they are shown. */
type CountKey = 'loans' | 'favorites' | 'savedSearches';
const KEYS: CountKey[] = ['loans', 'favorites', 'savedSearches'];

/** Material Symbols icon per item (font loaded by _shared-theme.scss). */
const ICONS: Record<CountKey, string> = {
  loans: 'menu_book',
  favorites: 'push_pin', // NDE's own favourites icon is a pin
  savedSearches: 'saved_search',
};

/** What is kept in localStorage (and in memory). null = unknown → item hidden. */
interface StoredCounts {
  loans: number | null;
  favorites: number | null;
  savedSearches: number | null;
  /** Short hash of the patron's primary id — see "SHARED PCs" above. */
  patron: string;
  /** Epoch ms of the last successful update — informational, for debugging. */
  savedAt: number;
}

@Component({
  selector: 'custom-ec-account-counts',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-account-counts' },
  template: '', // headless — see header comment
})
export class EcAccountCountsComponent implements OnDestroy {
  private readonly auth = inject(AuthStateService);
  private readonly userInfo = inject(UserInfoService);

  /**
   * Counts confirmed for the CURRENT signed-in session (fetched now, or stored
   * ones that belong to this patron). null while signed in but not yet known —
   * nothing is shown in that state unless the stored counts match the patron.
   */
  private sessionCounts: StoredCounts | null = null;
  /** True while requests are in flight, so the poll does not start a second round. */
  private loading = false;
  /** Set when a new landing-page render (or a sign-in) asks for fresh numbers. */
  private wantFetch = false;
  private readonly poll: number;

  constructor() {
    // Sign-in state changed: forget the session's numbers and ask for fresh
    // ones. After a sign-OUT the stored counts take over (guest view).
    effect(() => {
      this.auth.isSignedIn(); // read → tracked
      this.sessionCounts = null;
      this.wantFetch = true;
      this.tick();
    });

    // The landing page HTML arrives asynchronously and is re-rendered when the
    // patron navigates back to it, so keep checking for the container.
    this.poll = window.setInterval(() => this.tick(), POLL_MS);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.poll);
  }

  /** One pass: fetch if needed, then (re)fill the containers. Cheap when there is nothing to do. */
  private tick(): void {
    if (!CONFIG?.enabled) return;
    const targets = this.containers();
    if (targets.length === 0) return; // not on the landing page

    // A container we have not seen before = the landing page was (re)rendered
    // → fetch fresh numbers for this visit.
    targets.forEach((el) => {
      if (!el.hasAttribute(SEEN_ATTR)) {
        el.setAttribute(SEEN_ATTR, '');
        this.wantFetch = true;
      }
    });

    if (!this.auth.isSignedIn()) {
      // Guest: show what the last signed-in visit left behind (if anything).
      this.render(targets, readStored());
      return;
    }

    if (this.wantFetch && !this.loading) {
      this.wantFetch = false;
      this.loading = true;
      void this.refresh()
        .finally(() => {
          this.loading = false;
          // Fill immediately rather than waiting for the next poll.
          this.render(this.containers(), this.sessionCounts);
        });
    }
    this.render(targets, this.sessionCounts);
  }

  private containers(): NodeListOf<HTMLElement> {
    return document.querySelectorAll<HTMLElement>('[data-ec-account-counts]');
  }

  // ----------------------------------------------------------------- data

  /**
   * Fetch the three counts for the signed-in patron, merge them with what is
   * stored for the same patron (per-item fallback on failure), store the result
   * and keep it as this session's numbers.
   */
  private async refresh(): Promise<void> {
    // patron_id = the patron's primary id, which UserInfoService reads from the JWT.
    const user = await this.userInfo.load();
    if (!user?.primaryId) return; // cannot fetch; nothing shown while signed in

    const patron = hashId(user.primaryId);
    const stored = readStored();
    const previous = stored && stored.patron === patron ? stored : null;

    // Show the patron's own stored numbers while the requests run (no flicker
    // on a normal return visit); someone else's numbers are never shown.
    if (!this.sessionCounts && previous) {
      this.sessionCounts = previous;
      this.render(this.containers(), previous);
    }

    const [loans, favorites, savedSearches] = await Promise.all([
      this.fetchCount('loans', user.primaryId),
      this.fetchCount('favorites', user.primaryId),
      this.fetchCount('savedSearches', user.primaryId),
    ]);

    // Signed out while we were waiting? Then these numbers must not be shown
    // as "session" numbers — but they are still the patron's latest, so store them.
    const next: StoredCounts = {
      loans: loans ?? previous?.loans ?? null,
      favorites: favorites ?? previous?.favorites ?? null,
      savedSearches: savedSearches ?? previous?.savedSearches ?? null,
      patron,
      savedAt: Date.now(),
    };
    writeStored(next);
    if (this.auth.isSignedIn()) this.sessionCounts = next;
  }

  /** One endpoint → one number; null on any failure (the caller falls back). */
  private async fetchCount(key: CountKey, patronId: string): Promise<number | null> {
    const cfg = CONFIG!;
    const vid = currentVid();
    const template = key === 'loans' ? cfg.loansEndpoint
      : key === 'favorites' ? cfg.favoritesEndpoint
      : cfg.savedSearchesEndpoint;
    const url = template
      .replace('{type}', cfg.testWithPastLoans ? 'history' : 'active')
      .replace('{lang}', encodeURIComponent(currentLang()))
      .replace('{inst}', encodeURIComponent(vid.split(':')[0])) // "32EUC_INST:VU2" → "32EUC_INST"
      .replace('{patronId}', encodeURIComponent(patronId))
      .replace('{vid}', encodeURIComponent(vid));

    const headers: Record<string, string> = { Accept: 'application/json' };
    try {
      // Primo stores the JWT JSON-stringified (with quotes) in sessionStorage.
      const jwt = sessionStorage.getItem(EC_CONFIG.userInfo.jwtStorageKey)?.replace(/^"|"$/g, '');
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { headers, credentials: 'same-origin' });
      if (!res.ok) {
        console.warn(`[ec] account-counts: ${key} request failed: ${res.status} ${url}`);
        return null;
      }
      return countFrom(key, await res.json());
    } catch (err) {
      console.warn(`[ec] account-counts: ${key} request errored`, err);
      return null;
    }
  }

  // -------------------------------------------------------------- display

  /** Rebuild the links in every container; `counts` null or all-zero hides them. */
  private render(targets: NodeListOf<HTMLElement>, counts: StoredCounts | null): void {
    const cfg = CONFIG!;
    // Signature of what should be on screen; containers already showing it are
    // left alone, so the 1.5 s poll does not rebuild the DOM every time.
    const shown = KEYS.filter((k) => (counts?.[k] ?? 0) > 0);
    const signature = `${currentLang()}|${localised(cfg.welcomeLabel ?? { en: '' })}|${shown.map((k) => `${k}=${counts![k]}`).join(',')}`;

    targets.forEach((box) => {
      box.classList.toggle('ec-account-counts--show', shown.length > 0);
      if (box.dataset['ecAccountCountsState'] === signature) return;
      box.dataset['ecAccountCountsState'] = signature;

      box.setAttribute('aria-label', localised(cfg.ariaLabel));
      const links = shown.map((k) => this.buildLink(k, counts![k]!));

      // "Welcome back" line above the links (setting accountCounts.welcomeLabel).
      // Only built when there are links, so it appears and disappears with them.
      // Skipped for a container marked data-ec-account-counts-welcome="off"
      // (the signed-in block, whose heading already says "Welcome back") and
      // when the label is empty. The CSS gives it a full row (flex-basis 100%),
      // so the links wrap onto the line below it.
      const welcomeText = localised(cfg.welcomeLabel ?? { en: '' }).trim();
      const wantWelcome = links.length > 0 && welcomeText !== ''
        && box.dataset['ecAccountCountsWelcome'] !== 'off';
      if (wantWelcome) {
        const welcome = document.createElement('p');
        welcome.className = 'ec-account-counts__welcome';
        welcome.textContent = welcomeText;
        box.replaceChildren(welcome, ...links);
      } else {
        box.replaceChildren(...links);
      }
    });
  }

  /**
   * One item:
   *   <a href="#" data-ec-nav="account/loans" class="ec-account-counts__item ec-account-counts__item--loans">
   *     <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
   *     <span class="ec-account-counts__text">2 loans</span>
   *   </a>
   * The click is handled by EcSessionComponent (delegated on <body>, so links
   * created later work too), which keeps the current vid and lang.
   */
  private buildLink(key: CountKey, n: number): HTMLAnchorElement {
    const cfg = CONFIG!;
    const item = cfg[key];

    const a = document.createElement('a');
    a.href = '#';
    a.setAttribute('role', 'link');
    a.dataset['ecNav'] = item.route;
    a.className = `ec-account-counts__item ec-account-counts__item--${key}`;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[key];

    const text = document.createElement('span');
    text.className = 'ec-account-counts__text';
    text.textContent = pluralise(localised(item.label), n);

    a.append(icon, text);
    return a;
  }
}

/**
 * Read the number out of a response. The shapes (Oct 2026):
 *   loans          { data: { loans: { loan: [ … ] } } }
 *   favorites      { totalItems: 37, records: [ … ], labels: {…} }
 *   savedSearches  { queriesCount: 0, searchesList: [ … ] }
 * Returns null when the expected field is missing (shape changed upstream) so
 * a wrong 0 is never stored.
 */
function countFrom(key: CountKey, json: any): number | null {
  switch (key) {
    case 'loans': {
      // NOTE: `showmore: ["Y"]` would mean NDE pages the list; with the loan
      // limits of the EC libraries the first page always holds them all.
      const list = json?.data?.loans?.loan;
      return Array.isArray(list) ? list.length : null;
    }
    case 'favorites':
      return typeof json?.totalItems === 'number' ? json.totalItems
        : Array.isArray(json?.records) ? json.records.length : null;
    case 'savedSearches':
      return typeof json?.queriesCount === 'number' ? json.queriesCount
        : Array.isArray(json?.searchesList) ? json.searchesList.length : null;
  }
}

/**
 * "singular|plural" label → text for n. `{n}` is replaced by the number.
 *   pluralise('{n} loan|{n} loans', 1) → "1 loan"
 *   pluralise('{n} loan|{n} loans', 3) → "3 loans"
 * Without a "|" the same text is used for both. (0 is never shown, so the
 * French rule "0 = singular" does not matter here.)
 */
function pluralise(label: string, n: number): string {
  const [one, many] = label.split('|');
  return (n === 1 ? one : (many ?? one)).replace(/\{n\}/g, String(n)).trim();
}

// ------------------------------------------------------------ storage

/** localStorage key for this view, e.g. "ec-account-counts:32EUC_INST:VU2". */
function storageKey(): string {
  return `${CONFIG!.storageKeyPrefix}${currentVid()}`;
}

/** Stored counts, or null (nothing stored, unreadable, or storage blocked). */
function readStored(): StoredCounts | null {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && typeof parsed.patron === 'string' ? parsed : null;
  } catch {
    return null; // private mode / blocked storage: feature simply shows nothing for guests
  }
}

function writeStored(counts: StoredCounts): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(counts));
  } catch {
    /* storage full or blocked — the signed-in view still works from memory */
  }
}

/**
 * Short, non-reversible-enough tag for the patron id (FNV-1a, 32 bit, base 36).
 * Only used to tell "same patron or not" on this browser; it is not a security
 * measure and the id itself is never written to storage.
 */
function hashId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
