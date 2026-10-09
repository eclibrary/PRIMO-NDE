// src/app/shared/components/ec-library-on-the-go/ec-library-on-the-go.component.ts
//
// "Library on the Go" badge on a record.
//
// WHAT: "Library on the Go" is a digital collection of titles that can be read
// OUTSIDE the EC network with EU Login. For records in that collection this
// adds, at the end of the record's top line (JOURNAL | PEER REVIEWED | …):
//
//     | LIBRARY ON THE GO (i)
//
// The (i) button opens a dialog explaining what Library on the Go is.
//
// WHERE: slot `nde-record-type-after` (see shared-mappings.ts). nde-record-type
// is the first element of that top line and exists on every record, both in the
// results list and at the top of the full record (same markup). The line is:
//
//     <div class="flex-row flex-wrap-wrap">           ← the "line" (a flex row)
//       <nde-record-type>…</nde-record-type>
//       [our element lands here]
//       <nde-record-indications>…</nde-record-indications>   (peer reviewed, open access, …)
//       <nde-search-result-journal-indication-line>…
//     </div>
//
// To sit AFTER whatever the line contains, the host element is moved to the end
// of that flex row (placeAtEndOfLine) and additionally given `order: 1` in CSS,
// so indications NDE renders later still come before it.
//
// HOW A RECORD IS RECOGNISED: PNX field control.colldiscovery lists the
// collections the record is in, one entry per collection, e.g.
//     "$$Titem$$D8183322120004061$$I32EUC_INST"       ($$D = collection id)
// The record is a member when an entry's $$D equals the configured
// `collectionId`.
//
// WHERE THE PNX COMES FROM — two sources, tried in this order:
//   1. The NDE component of the slot (`hostComponent`). Which property holds
//      the record differs per NDE component/release, so findPnxOnHost() looks
//      at every property (unwrapping Angular signals) for an object with a
//      `pnx.control` — no property name is hard-coded.
//   2. Fallback when the host does not expose the record: the record id is read
//      from the title link in the same row (<a id="record_id_alma…">) and the
//      PNX is fetched from Primo's own endpoint (pnxEndpoint setting). One
//      request per record, cached for the page session (PNX_CACHE).
// If you see many `pnxs/L/…` requests in the Network tab, source 1 is not
// working on this NDE release; the feature still works, just less efficiently.
//
// SETTINGS: EC_CONFIG.libraryOnTheGo (config/global.json, per-view override in
// config/views/<view>.json) — `npm run settings`, section "Library on the Go":
// on/off, collection id, label, colour, dialog title + HTML text.
// The dialog HTML is rendered via [innerHTML], i.e. sanitised by Angular
// (scripts, inline style and data-* attributes are removed; class is kept).
import {
  AfterViewInit, Component, DoCheck, ElementRef, Input, ViewChild, ViewEncapsulation, inject, signal,
} from '@angular/core';
import { EC_CONFIG, currentLang, currentVid, localised } from '../../ec-config';

/** Section may be missing from an older generated config → feature off, no crash. */
const CONFIG = EC_CONFIG.libraryOnTheGo;

/** Minimal shape of the part of a PNX this component reads. */
interface Pnx {
  control?: { recordid?: string[]; colldiscovery?: string[] };
}

/**
 * Fallback fetches by record id, shared by every instance on the page so a
 * record shown twice (results list + full record) is requested once.
 * Holds promises so concurrent rows wait for the same request.
 */
const PNX_CACHE = new Map<string, Promise<Pnx | null>>();

/** Counter for unique dialog-title ids (aria-labelledby) — many badges per page. */
let nextId = 0;

@Component({
  selector: 'custom-ec-library-on-the-go',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-library-on-the-go' },
  template: `
    @if (member()) {
      <span class="ec-lotg" [style.--ec-lotg-color]="color">
        <!-- Vertical rule, like the one NDE draws before "Peer reviewed". -->
        <span class="ec-lotg__divider" aria-hidden="true"></span>
        <span class="ec-lotg__label">{{ label }}</span>
        <!-- (i) — Material Symbols font (loaded by _shared-theme.scss). -->
        <button type="button" class="ec-lotg__info" [attr.aria-label]="infoLabel" (click)="open($event)">
          <span class="material-symbols-outlined" aria-hidden="true">info</span>
        </button>
      </span>

      <!-- Native <dialog>: focus trap, Esc and backdrop for free (same approach
           as the Ask-a-librarian and welcome-message modals). stopPropagation:
           the dialog lives inside the record row, whose click opens the record. -->
      <dialog #dialog class="ec-lotg-dialog" [attr.aria-labelledby]="titleId"
              (click)="onDialogClick($event)">
        <div class="ec-lotg-dialog__panel">
          <header class="ec-lotg-dialog__bar">
            <h2 class="ec-lotg-dialog__title" [id]="titleId">{{ dialogTitle }}</h2>
          </header>
          <div class="ec-lotg-dialog__body" [innerHTML]="dialogHtml"></div>
          <footer class="ec-lotg-dialog__footer">
            <button type="button" class="ec-lotg-dialog__close" autofocus (click)="close()">{{ closeLabel }}</button>
          </footer>
        </div>
      </dialog>
    }
  `,
  styleUrls: ['./ec-library-on-the-go.component.scss'],
  // None: the dialog body is injected HTML ([innerHTML]) which emulated
  // encapsulation cannot reach, and the host needs `order` inside NDE's flex
  // row. All rules are prefixed .ec-lotg / custom-ec-library-on-the-go by hand.
  encapsulation: ViewEncapsulation.None,
})
export class EcLibraryOnTheGoComponent implements AfterViewInit, DoCheck {
  /** The NDE component this slot belongs to (nde-record-type), injected by the shell. */
  @Input() hostComponent: any;

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLDialogElement>;
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** True when the current record is in the Library on the Go collection. */
  readonly member = signal(false);

  // Texts for the current interface language (fixed for the life of the page:
  // NDE reloads when the language is switched).
  private readonly lang = currentLang();
  readonly label = CONFIG ? localised(CONFIG.label, this.lang) : '';
  readonly infoLabel = CONFIG ? localised(CONFIG.infoButtonLabel, this.lang) : '';
  readonly dialogTitle = CONFIG ? localised(CONFIG.dialogTitle, this.lang) : '';
  readonly dialogHtml = CONFIG ? localised(CONFIG.dialogHtml, this.lang) : '';
  readonly closeLabel = CONFIG ? localised(CONFIG.closeLabel, this.lang) : '';
  readonly color = CONFIG?.color ?? '';
  readonly titleId = `ec-lotg-title-${nextId++}`;

  /**
   * Record the badge was last evaluated for. NDE can reuse a row component for
   * another record (paging), so ngDoCheck re-evaluates when this changes.
   * `undefined` = not evaluated yet.
   */
  private evaluatedFor: string | undefined;

  ngAfterViewInit(): void {
    this.placeAtEndOfLine();
  }

  /**
   * Runs on every change-detection pass, so it must stay cheap: one id lookup
   * and a string comparison; the real work happens only when the record changes.
   */
  ngDoCheck(): void {
    if (!CONFIG?.enabled || !CONFIG.collectionId) return;

    const hostPnx = this.findPnxOnHost();
    const recordId = hostPnx?.control?.recordid?.[0] ?? this.recordIdFromDom();
    if (!recordId || recordId === this.evaluatedFor) return;
    this.evaluatedFor = recordId;

    if (hostPnx) {
      // Source 1: the record is right there on the NDE component.
      this.show(isMember(hostPnx));
    } else {
      // Source 2: fetch it. Guard against a slow answer for a record this row
      // no longer shows.
      this.member.set(false);
      void fetchPnx(recordId).then((pnx) => {
        if (this.evaluatedFor === recordId) this.show(!!pnx && isMember(pnx));
      });
    }
  }

  // ------------------------------------------------------------ placement

  /**
   * Move our host element to the end of the record's top line (the flex row
   * that contains nde-record-type). Covers both ways NDE may have inserted the
   * slot: as a sibling of nde-record-type (then this is a simple reorder) or
   * nested somewhere inside it. Angular keeps working with a moved host node.
   */
  private placeAtEndOfLine(): void {
    const host = this.el.nativeElement;
    const row = host.closest('nde-search-result-item-container');
    const line = row?.querySelector('nde-record-type')?.parentElement;
    if (line && line.lastElementChild !== host) line.appendChild(host);
  }

  /** Show/hide the badge; when shown, line it up once it has been painted. */
  private show(isMember: boolean): void {
    this.member.set(isMember);
    // The badge is rendered by the next change detection; one animation frame
    // later it has a size and position that can be measured.
    if (isMember) requestAnimationFrame(() => this.alignWithLine());
  }

  /**
   * VERTICAL ALIGNMENT. NDE's own entries on the line ("JOURNAL", "PEER
   * REVIEWED") get their vertical position from styles scoped to NDE's
   * components, which we can neither reuse nor rely on staying the same. So
   * instead of guessing paddings, measure: compare the vertical centre of the
   * record-type text with the centre of our label and shift our element by the
   * difference (position: relative — the layout of the line is not touched).
   * Skipped when the badge wrapped to a second line (large difference).
   */
  private alignWithLine(): void {
    const host = this.el.nativeElement;
    const reference = host.parentElement?.querySelector('nde-record-type .record-type');
    const label = host.querySelector('.ec-lotg__label');
    if (!reference || !label) return;

    host.style.top = ''; // measure from the natural position
    const centre = (el: Element) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const delta = centre(reference) - centre(label);
    const sameLine = Math.abs(delta) <= 12;
    host.style.position = 'relative';
    host.style.top = sameLine && Math.abs(delta) >= 0.5 ? `${delta.toFixed(1)}px` : '';
  }

  // ------------------------------------------------------- finding the PNX

  /**
   * Look on the NDE host component for the record. Property names are not
   * documented and differ between components, so check every own property:
   * a value (or the value inside an Angular signal) that has `pnx.control`
   * is the record; a value that itself has `control.recordid` is a bare PNX.
   */
  private findPnxOnHost(): Pnx | null {
    const hc = this.hostComponent;
    if (!hc || typeof hc !== 'object') return null;
    for (const key of Object.keys(hc)) {
      let value: any;
      try {
        value = unwrapSignal(hc[key]);
      } catch {
        continue; // a getter/signal that throws is simply not our record
      }
      if (value?.pnx?.control) return value.pnx as Pnx;
      if (Array.isArray(value?.control?.recordid)) return value as Pnx;
    }
    return null;
  }

  /** Record id from the title link of the same row: <a id="record_id_alma996…">. */
  private recordIdFromDom(): string {
    const row = this.el.nativeElement.closest('nde-search-result-item-container');
    const id = row?.querySelector('a[id^="record_id_"]')?.id ?? '';
    return id.replace(/^record_id_/, '');
  }

  // ----------------------------------------------------------------- dialog

  open(ev: Event): void {
    // Do not let the click reach the record row (it would open the full record).
    ev.stopPropagation();
    ev.preventDefault();
    this.dialogRef?.nativeElement.showModal();
  }

  close(): void {
    this.dialogRef?.nativeElement.close();
  }

  /**
   * Clicks inside the dialog must not bubble to the record row either; a click
   * on the <dialog> element itself (not the panel) is a backdrop click → close.
   */
  onDialogClick(ev: MouseEvent): void {
    ev.stopPropagation();
    if (ev.target === this.dialogRef?.nativeElement) this.close();
  }
}

// ---------------------------------------------------------------- helpers

/**
 * True when control.colldiscovery has an entry for the configured collection.
 * Entries look like "$$Titem$$D<collection id>$$I<institution>"; the id is
 * compared exactly (not "contains") so one id cannot match inside a longer one.
 */
function isMember(pnx: Pnx): boolean {
  const wanted = CONFIG?.collectionId.trim();
  if (!wanted) return false;
  return (pnx.control?.colldiscovery ?? []).some((entry) => /\$\$D([^$]+)/.exec(entry)?.[1] === wanted);
}

/**
 * Angular signals are zero-argument functions carrying a symbol-keyed marker
 * property; plain methods have none. Only such functions are called — never an
 * arbitrary method of the NDE component.
 */
function unwrapSignal(value: any): any {
  if (typeof value === 'function' && value.length === 0 && Object.getOwnPropertySymbols(value).length > 0) {
    return value();
  }
  return value;
}

/**
 * Fallback: fetch the PNX of one record from Primo (the endpoint NDE uses
 * itself). Sends the session JWT like NDE does; guests have a guest JWT.
 * Resolves to null on any failure — the badge is then simply not shown.
 */
function fetchPnx(recordId: string): Promise<Pnx | null> {
  let pending = PNX_CACHE.get(recordId);
  if (!pending) {
    pending = (async () => {
      const url = CONFIG!.pnxEndpoint
        .replace('{recordId}', encodeURIComponent(recordId))
        .replace('{vid}', encodeURIComponent(currentVid()))
        .replace('{lang}', encodeURIComponent(currentLang()));
      const headers: Record<string, string> = { Accept: 'application/json' };
      try {
        // Primo stores the JWT JSON-stringified (with quotes) in sessionStorage.
        const jwt = sessionStorage.getItem(EC_CONFIG.userInfo.jwtStorageKey)?.replace(/^"|"$/g, '');
        if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
        const res = await fetch(url, { headers, credentials: 'same-origin' });
        if (!res.ok) {
          console.warn(`[ec] library-on-the-go: PNX request failed: ${res.status} ${url}`);
          return null;
        }
        const body = await res.json();
        return (body?.pnx ?? body) as Pnx;
      } catch (err) {
        console.warn('[ec] library-on-the-go: PNX request errored', err);
        return null;
      }
    })();
    PNX_CACHE.set(recordId, pending);
  }
  return pending;
}
