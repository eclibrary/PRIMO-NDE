// src/app/shared/components/ec-loans-due/ec-loans-due.component.ts
//
// "Loans due soon" on the landing page — headless.
//
// WHAT: for a signed-in patron, shows a line such as
//     Overdue loans: 1 · Loans due within 7 days: 2
// linking to the loans in the library card. Nothing is shown to guests, or
// when no loan is overdue or due soon.
//
// HOW IT'S SHOWN: like EcLastSearchComponent, this component renders nothing
// itself; it fills markup that sits in the static landing page HTML:
//
//     <p class="ec-loans-due" data-ec-loans-due>
//       <span class="material-symbols-outlined" aria-hidden="true">event_upcoming</span>
//       <a href="#" data-ec-nav="account" data-ec-query="section=loans" data-ec-loans-due-text></a>
//     </p>
//
//   - [data-ec-loans-due]       the line; gets class `ec-loans-due--show` when
//                               there is something to say (CSS in homepage.css
//                               hides it otherwise) and `ec-loans-due--overdue`
//                               when at least one loan is overdue.
//   - [data-ec-loans-due-text]  receives the text. The link itself is an
//                               ordinary data-ec-nav link (EcSessionComponent).
// Put the line wherever it should appear — Find-eR has it in both the
// "Pick up where you left off" block and the "Welcome back" block, so it is
// visible whichever of the two is shown.
//
// WHERE THE DATA COMES FROM: the endpoint NDE's own library card calls,
//     /primaws/rest/priv/myaccount/loans?type=active&…&patron_id=<id>
// (setting loansDue.endpoint), with the session JWT. Each loan carries
//     "duedate": "20260209"  (YYYYMMDD)   and   "duehour": "0900"  (HHMM)
// in the library's local time. Only counts are derived; no loan data is
// stored anywhere, and titles are not shown.
//
// WHEN IT FETCHES: only when the patron is signed in AND the markup above is
// on the page (i.e. on the landing page) — never on results or record pages.
// The result is kept for CACHE_MS so moving back and forth to the landing page
// does not hit the server each time; sign-in/sign-out clears it.
//
// TESTING WITHOUT ACTIVE LOANS: setting loansDue.testWithPastLoans makes the
// component read the loan HISTORY instead, whose due dates lie in the past, so
// every past loan counts as overdue and the line becomes visible.
// NEVER leave that on in production — patrons would be told they have overdue
// loans.
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
import { Component, OnDestroy, effect, inject } from '@angular/core';
import { AuthStateService } from '../../auth-state.service';
import { EC_CONFIG, currentLang, currentVid, localised } from '../../ec-config';
import { UserInfoService } from '../../user-info.service';

/** Section may be missing from an older generated config → feature off, no crash. */
const CONFIG = EC_CONFIG.loansDue;

/** How long a fetched result is reused (ms). */
const CACHE_MS = 5 * 60 * 1000;
/** How often the page is checked for the markup (ms). The check itself is one querySelectorAll. */
const POLL_MS = 1500;

/** What is derived from the loans response. */
interface DueCounts {
  overdue: number;
  dueSoon: number;
  /** Epoch ms of the fetch — for CACHE_MS. */
  fetchedAt: number;
}

/** The fields of a Primo loan this component reads (the response has many more). */
interface PrimoLoan {
  duedate?: string; // "YYYYMMDD"
  duehour?: string; // "HHMM"
}

@Component({
  selector: 'custom-ec-loans-due',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-loans-due' },
  template: '', // headless — see header comment
})
export class EcLoansDueComponent implements OnDestroy {
  private readonly auth = inject(AuthStateService);
  private readonly userInfo = inject(UserInfoService);

  /** Last result; null = nothing fetched (or cleared by a sign-in change). */
  private counts: DueCounts | null = null;
  /** True while a request is in flight, so the poll does not start a second one. */
  private loading = false;
  private readonly poll: number;

  constructor() {
    // Sign-in state changed: forget what we know and re-evaluate right away, so
    // a patron who signs out never leaves their counts on screen.
    effect(() => {
      this.auth.isSignedIn(); // read → tracked
      this.counts = null;
      this.tick();
    });

    // The landing page HTML arrives asynchronously and is re-rendered when the
    // patron navigates back to it, so keep checking for the markup.
    this.poll = window.setInterval(() => this.tick(), POLL_MS);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.poll);
  }

  /** One pass: fetch if needed, then (re)fill the markup. Cheap when there is nothing to do. */
  private tick(): void {
    if (!CONFIG?.enabled) return;
    const targets = document.querySelectorAll<HTMLElement>('[data-ec-loans-due]');
    if (targets.length === 0) return; // not on the landing page

    if (!this.auth.isSignedIn()) {
      this.render(targets, null);
      return;
    }

    const stale = !this.counts || Date.now() - this.counts.fetchedAt > CACHE_MS;
    if (stale && !this.loading) {
      this.loading = true;
      void this.fetchCounts()
        .then((counts) => { this.counts = counts; })
        .finally(() => {
          this.loading = false;
          // Fill immediately rather than waiting for the next poll.
          this.render(document.querySelectorAll<HTMLElement>('[data-ec-loans-due]'), this.counts);
        });
    }
    this.render(targets, this.counts);
  }

  // ----------------------------------------------------------------- data

  /** Fetch the loans and reduce them to counts; null on any failure (line stays hidden). */
  private async fetchCounts(): Promise<DueCounts | null> {
    const cfg = CONFIG!;
    // patron_id = the patron's primary id, which UserInfoService reads from the JWT.
    const user = await this.userInfo.load();
    if (!user?.primaryId) return null;

    const vid = currentVid();
    const url = cfg.endpoint
      .replace('{type}', cfg.testWithPastLoans ? 'history' : 'active')
      .replace('{lang}', encodeURIComponent(currentLang()))
      .replace('{inst}', encodeURIComponent(vid.split(':')[0])) // "32EUC_INST:VU2" → "32EUC_INST"
      .replace('{patronId}', encodeURIComponent(user.primaryId))
      .replace('{vid}', encodeURIComponent(vid));

    const headers: Record<string, string> = { Accept: 'application/json' };
    try {
      // Primo stores the JWT JSON-stringified (with quotes) in sessionStorage.
      const jwt = sessionStorage.getItem(EC_CONFIG.userInfo.jwtStorageKey)?.replace(/^"|"$/g, '');
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
      const res = await fetch(url, { headers, credentials: 'same-origin' });
      if (!res.ok) {
        console.warn(`[ec] loans-due: request failed: ${res.status} ${url}`);
        return null;
      }
      // Response shape: { data: { loans: { loan: [ {duedate, duehour, …}, … ] } } }
      const loans: PrimoLoan[] = (await res.json())?.data?.loans?.loan ?? [];
      return countDue(loans, cfg.dueSoonDays);
    } catch (err) {
      console.warn('[ec] loans-due: request errored', err);
      return null;
    }
  }

  // -------------------------------------------------------------- display

  /** Fill every line on the page; `counts` null or all-zero hides them. */
  private render(targets: NodeListOf<HTMLElement>, counts: DueCounts | null): void {
    const cfg = CONFIG!;
    const parts: string[] = [];
    if (counts && counts.overdue > 0) {
      parts.push(localised(cfg.overdueLabel).replace('{n}', String(counts.overdue)));
    }
    if (counts && counts.dueSoon > 0) {
      parts.push(localised(cfg.dueSoonLabel)
        .replace('{n}', String(counts.dueSoon))
        .replace('{days}', String(cfg.dueSoonDays)));
    }
    const text = parts.join(' · ');

    targets.forEach((line) => {
      // The text goes into the marked child (the link) or, without one, the line itself.
      const slot = line.querySelector<HTMLElement>('[data-ec-loans-due-text]') ?? line;
      if (slot.textContent !== text) slot.textContent = text;
      line.classList.toggle('ec-loans-due--show', text !== '');
      line.classList.toggle('ec-loans-due--overdue', !!counts && counts.overdue > 0);
    });
  }
}

/**
 * Count overdue loans (due moment in the past) and loans due within `days`
 * days from now. A loan is in exactly one of the two groups, or in neither.
 * Loans without a readable due date are ignored.
 */
function countDue(loans: PrimoLoan[], days: number): DueCounts {
  const now = Date.now();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  let overdue = 0;
  let dueSoon = 0;
  for (const loan of loans) {
    const due = dueMoment(loan);
    if (due === null) continue;
    if (due < now) overdue++;
    else if (due <= horizon) dueSoon++;
  }
  return { overdue, dueSoon, fetchedAt: now };
}

/**
 * Due moment of a loan as epoch ms, from "duedate": "YYYYMMDD" and "duehour":
 * "HHMM", read as local time (patron and library share a time zone in
 * practice). Without a due hour the loan is due at the end of that day.
 */
function dueMoment(loan: PrimoLoan): number | null {
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(loan.duedate ?? '');
  if (!d) return null;
  const h = /^(\d{2})(\d{2})$/.exec(loan.duehour ?? '');
  const date = new Date(+d[1], +d[2] - 1, +d[3], h ? +h[1] : 23, h ? +h[2] : 59);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
