// src/app/shared/components/ec-record-line/ec-record-line.component.ts
//
// OUR ADDITIONS TO A RECORD'S TOP LINE (JOURNAL | PEER REVIEWED | …), in the
// results list and in the full record (same markup):
//
//     JOURNAL | PEER REVIEWED | LIBRARY ON THE GO (i) | 🔓 Free version (author manuscript)
//                               └ collection badges ┘   └ free version link (Unpaywall) ┘
//
// This component is the CONTAINER: it finds the record once and hands it to
//   - EcLibraryOnTheGoComponent  collection badges   (settings libraryOnTheGo)
//   - EcOpenAccessComponent      "Free version" link (settings openAccess)
// and it does the placement both need. Introduced Oct 2026, when the free
// version link joined the badge on the same slot (an NDE slot takes ONE component).
//
// WHERE: slot `nde-record-type-after` (shared-mappings.ts; noob: src/noob/core/mappings.ts).
// nde-record-type is the first element of the top line and exists on every
// record. The line is:
//
//     <div class="flex-row flex-wrap-wrap">           ← the "line" (a flex row)
//       <nde-record-type>…</nde-record-type>
//       [our element lands here]
//       <nde-record-indications>…</nde-record-indications>   (peer reviewed, open access, …)
//       <nde-search-result-journal-indication-line>…
//     </div>
//
// To sit AFTER whatever the line contains, the host element is moved to the
// end of that flex row (placeAtEndOfLine) and given `order: 1` in CSS, so
// indications NDE renders later still come before it.
//
// THE RECORD: see src/app/shared/record-doc.ts (on the NDE host component, or
// fetched by id as a fallback). NDE can reuse a row for another record
// (paging), so ngDoCheck looks again whenever the record id changes.
import {
  AfterViewInit, Component, DoCheck, ElementRef, Input, OnDestroy, ViewEncapsulation, inject, signal,
} from '@angular/core';
import { EC_CONFIG } from '../../ec-config';
import { RecordDoc, fetchDoc, findDocOnHost, recordIdFromRow } from '../../record-doc';
import { EcLibraryOnTheGoComponent } from '../ec-library-on-the-go/ec-library-on-the-go.component';
import { EcOpenAccessComponent } from '../ec-open-access/ec-open-access.component';

/** True when at least one feature of the line is switched on (else: no work at all). */
function anyFeatureOn(): boolean {
  const badges = EC_CONFIG.libraryOnTheGo;
  const oa = EC_CONFIG.openAccess;
  return !!(badges?.enabled && Array.isArray(badges.badges) && badges.badges.length)
    || !!(oa?.enabled && oa.email);
}

@Component({
  selector: 'custom-ec-record-line',
  standalone: true,
  imports: [EcLibraryOnTheGoComponent, EcOpenAccessComponent],
  host: { 'data-component-id': 'custom-ec-record-line' },
  template: `
    <custom-ec-library-on-the-go [doc]="doc()"></custom-ec-library-on-the-go>
    <custom-ec-open-access [doc]="doc()"></custom-ec-open-access>
  `,
  styles: [`
    /* The host sits in NDE's flex row. order: 1 (siblings are 0) keeps it LAST
       even when NDE inserts another indication after we were placed. Global
       (encapsulation None) because the rule targets our own host tag. */
    custom-ec-record-line { order: 1; display: inline-flex; align-items: center; flex-wrap: wrap; }
    /* The children only group template code; their content lays out in our flex box. */
    custom-ec-record-line > custom-ec-library-on-the-go,
    custom-ec-record-line > custom-ec-open-access { display: contents; }
  `],
  encapsulation: ViewEncapsulation.None,
})
export class EcRecordLineComponent implements AfterViewInit, DoCheck, OnDestroy {
  /** The NDE component this slot belongs to (nde-record-type), injected by the shell. */
  @Input() hostComponent: any;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The record of this row; null while unknown. */
  readonly doc = signal<RecordDoc | null>(null);

  /** Record id last looked up (`undefined` = not yet). */
  private evaluatedFor: string | undefined;
  private resize?: ResizeObserver;

  ngAfterViewInit(): void {
    this.placeAtEndOfLine();
    // Our content appears later (a badge, then maybe the free version link
    // after Unpaywall answered): re-align whenever our size changes. Shifting
    // with `top` does not change the size, so this cannot loop.
    if ('ResizeObserver' in window) {
      this.resize = new ResizeObserver(() => requestAnimationFrame(() => this.alignWithLine()));
      this.resize.observe(this.el.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  /**
   * Runs on every change-detection pass, so it must stay cheap: one id lookup
   * and a string comparison; the real work happens only when the record changes.
   */
  ngDoCheck(): void {
    if (!anyFeatureOn()) return;
    const hostDoc = findDocOnHost(this.hostComponent);
    const recordId = hostDoc?.pnx?.control?.recordid?.[0] ?? recordIdFromRow(this.el.nativeElement);
    if (!recordId || recordId === this.evaluatedFor) return;
    this.evaluatedFor = recordId;

    if (hostDoc) {
      this.doc.set(hostDoc);
    } else {
      // Fallback: fetch it. Guard against a slow answer for a record this row no longer shows.
      this.doc.set(null);
      void fetchDoc(recordId).then((d) => {
        if (this.evaluatedFor === recordId) this.doc.set(d);
      });
    }
  }

  /**
   * Move our host element to the end of the record's top line (the flex row
   * that contains nde-record-type). Covers both ways NDE may have inserted the
   * slot: as a sibling of nde-record-type or nested inside it.
   */
  private placeAtEndOfLine(): void {
    const host = this.el.nativeElement;
    const row = host.closest('nde-search-result-item-container');
    const line = row?.querySelector('nde-record-type')?.parentElement;
    if (line && line.lastElementChild !== host) line.appendChild(host);
  }

  /**
   * VERTICAL ALIGNMENT. NDE's own entries on the line get their position from
   * styles scoped to NDE's components, which we can neither reuse nor rely on.
   * So measure: compare the vertical centre of the record-type text with the
   * centre of our first text (marked data-ec-align) and shift by the
   * difference (position: relative — the line's layout is not touched).
   * Skipped when we wrapped to a second line (large difference).
   */
  private alignWithLine(): void {
    const host = this.el.nativeElement;
    const reference = host.parentElement?.querySelector('nde-record-type .record-type');
    const label = host.querySelector('[data-ec-align]');
    if (!reference || !label) return;

    host.style.top = ''; // measure from the natural position
    const centre = (el: Element) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const delta = centre(reference) - centre(label);
    const sameLine = Math.abs(delta) <= 12;
    host.style.position = 'relative';
    host.style.top = sameLine && Math.abs(delta) >= 0.5 ? `${delta.toFixed(1)}px` : '';
  }
}
