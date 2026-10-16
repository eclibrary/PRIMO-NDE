// src/app/shared/components/ec-open-access/ec-open-access.component.ts
//
// "FREE VERSION" LINK (settings openAccess, "Free versions (Unpaywall)") at
// the end of a record's top line:
//
//     JOURNAL | PEER REVIEWED | 🔓 Free version (author manuscript) ↗
//
// WHAT: for a record with a DOI, ask Unpaywall (https://unpaywall.org — free,
// run by the non-profit OurResearch) whether a legal free copy exists: the
// publisher's open-access version or the author's manuscript in a repository.
// If so, link to it (new tab). The text in brackets says which version it is
// (Unpaywall's `version`: publishedVersion / acceptedVersion / submittedVersion
// → settings publishedLabel / acceptedLabel / submittedLabel; empty = no brackets).
//
// WHEN NOT:
//   - switched off, or no contact e-mail in the settings (Unpaywall requires one);
//   - no DOI in the record (pnx.addata.doi, or "DOI: …" in display.identifier);
//   - onlyWithoutFullText is on and the record already has online access
//     through the library (delivery.availability starts with "fulltext");
//   - Unpaywall knows no free copy, does not answer, or answers with an error.
//
// THE REQUEST: GET https://api.unpaywall.org/v2/<DOI>?email=<contact e-mail>
// straight from the visitor's browser (Unpaywall allows that: CORS is open).
// Unpaywall sees the DOI and the visitor's IP address — nothing else, no
// patron data. That is why the feature is OFF by default and the settings text
// asks libraries to mention it in their privacy notice. Limit: about 100,000
// requests a day per e-mail, far more than one library needs. Answers are kept
// per DOI for the browser session (sessionStorage, ANSWER_KEY) and in memory,
// so paging back and forth asks once.
//
// PART OF THE RECORD LINE: EcRecordLineComponent finds the record and passes
// it as `doc`; it also does the placement in NDE's line.
import { Component, Input, OnChanges, ViewEncapsulation, signal } from '@angular/core';
import { EC_CONFIG, currentLang, localised } from '../../ec-config';
import { RecordDoc } from '../../record-doc';

const CONFIG = EC_CONFIG.openAccess;

/** Unpaywall REST API (v2). */
const API = 'https://api.unpaywall.org/v2/';
/** sessionStorage key prefix for answers ("" = no free copy). */
const ANSWER_KEY = 'ec:oa:';

/** What we keep of an Unpaywall answer. */
interface FreeCopy {
  url: string;
  /** publishedVersion | acceptedVersion | submittedVersion | '' */
  version: string;
}

/** Answers by DOI for this page — promises, so rows showing the same DOI ask once. */
const MEMO = new Map<string, Promise<FreeCopy | null>>();

/** The link as drawn. */
interface Link {
  href: string;
  text: string;
  title: string;
}

@Component({
  selector: 'custom-ec-open-access',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-open-access' },
  template: `
    @if (link(); as l) {
      <span class="ec-oa">
        <span class="ec-oa__divider" aria-hidden="true"></span>
        <!-- stopPropagation: the row's click would open the full record instead. -->
        <a class="ec-oa__link" [href]="l.href" target="_blank" rel="noopener" [attr.title]="l.title || null"
           (click)="$event.stopPropagation()">
          <span class="material-symbols-outlined" aria-hidden="true">lock_open</span>
          <span class="ec-oa__label" data-ec-align>{{ l.text }}</span>
        </a>
      </span>
    }
  `,
  styles: [`
    /* Global (encapsulation None): every selector starts with .ec-oa. */
    .ec-oa { display: inline-flex; align-items: center; }
    .ec-oa__divider { align-self: stretch; width: 1px; min-height: 1.25rem; margin: 0 .625rem;
      background: var(--sys-outline-variant, #c4c7c5); }
    .ec-oa__link { display: inline-flex; align-items: center; gap: .2rem;
      color: var(--ec-blue, #004494) !important; text-decoration: none; }
    .ec-oa__link:hover .ec-oa__label { text-decoration: underline; }
    .ec-oa__link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; }
    /* More specific than the global .material-symbols-outlined rule (28px). */
    .ec-oa__link .material-symbols-outlined { font-size: 1.05rem; line-height: 1; margin: 0; color: inherit; }
    /* Same typography as NDE's indications on this line. */
    .ec-oa__label { font-size: .8125rem; font-weight: 600; letter-spacing: .03em; white-space: nowrap; }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class EcOpenAccessComponent implements OnChanges {
  /** The record of the row (from EcRecordLineComponent); null while unknown. */
  @Input() doc: RecordDoc | null = null;

  readonly link = signal<Link | null>(null);

  /** DOI the current link (or lookup) is for — stale answers are dropped. */
  private forDoi = '';

  ngOnChanges(): void {
    const doi = this.wanted();
    if (doi === this.forDoi) return;
    this.forDoi = doi;
    this.link.set(null);
    if (!doi) return;
    void lookUp(doi).then((copy) => {
      if (this.forDoi !== doi || !copy) return;
      this.link.set(toLink(copy));
    });
  }

  /** The DOI to look up for this record, or '' when no lookup is wanted. */
  private wanted(): string {
    if (!CONFIG?.enabled || !CONFIG.email?.trim() || !this.doc) return '';
    if (CONFIG.onlyWithoutFullText) {
      const availability = this.doc.delivery?.availability ?? [];
      if (availability.some((a) => /^fulltext/i.test(a))) return '';
    }
    return doiOf(this.doc);
  }
}

/**
 * The record's DOI, normalised ("10.…", lower case, no https://doi.org/):
 * pnx.addata.doi first, else an identifier line such as "DOI: 10.1234/abc".
 */
function doiOf(doc: RecordDoc): string {
  const candidates = [...(doc.pnx?.addata?.doi ?? []), ...(doc.pnx?.display?.identifier ?? [])];
  for (const c of candidates) {
    const m = /(10\.\d{4,9}\/[^\s"<>]+)/.exec(c ?? '');
    if (m) return m[1].replace(/[.,;]+$/, '').toLowerCase();
  }
  return '';
}

/** Unpaywall's best free copy for a DOI, or null. Never rejects. */
function lookUp(doi: string): Promise<FreeCopy | null> {
  let pending = MEMO.get(doi);
  if (pending) return pending;
  pending = (async () => {
    // Answer from earlier in this browser session?
    try {
      const kept = sessionStorage.getItem(ANSWER_KEY + doi);
      if (kept !== null) return kept ? (JSON.parse(kept) as FreeCopy) : null;
    } catch { /* storage blocked or bad JSON: ask again */ }

    // Each part of the DOI encoded, the slashes kept: /v2/10.1038/nature12373.
    const path = doi.split('/').map(encodeURIComponent).join('/');
    const url = `${API}${path}?email=${encodeURIComponent(CONFIG!.email.trim())}`;
    let copy: FreeCopy | null = null;
    try {
      const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (res.ok) {
        const body = await res.json();
        const best = body?.is_oa ? body?.best_oa_location : null;
        const href = best?.url || best?.url_for_pdf || best?.url_for_landing_page || '';
        if (/^https?:\/\//i.test(href)) copy = { url: href, version: String(best?.version ?? '') };
      } else if (res.status !== 404) {
        // 404 = Unpaywall does not know the DOI: normal, not worth a line.
        console.warn(`[ec] free version: Unpaywall answered ${res.status} for ${doi}`);
        return null; // not remembered: may work next time
      }
    } catch (err) {
      console.warn('[ec] free version: Unpaywall request failed', err);
      return null; // network trouble: not remembered
    }
    try { sessionStorage.setItem(ANSWER_KEY + doi, copy ? JSON.stringify(copy) : ''); } catch { /* full or blocked */ }
    return copy;
  })();
  MEMO.set(doi, pending);
  return pending;
}

/** Link text: "Free version (author manuscript)" — brackets only when that text is set. */
function toLink(copy: FreeCopy): Link {
  const lang = currentLang();
  const versionText = {
    publishedVersion: CONFIG!.publishedLabel,
    acceptedVersion: CONFIG!.acceptedLabel,
    submittedVersion: CONFIG!.submittedLabel,
  }[copy.version];
  const extra = versionText ? localised(versionText, lang) : '';
  const base = localised(CONFIG!.linkLabel, lang) || 'Free version';
  return { href: copy.url, text: extra ? `${base} (${extra})` : base, title: localised(CONFIG!.linkTitle, lang) };
}
