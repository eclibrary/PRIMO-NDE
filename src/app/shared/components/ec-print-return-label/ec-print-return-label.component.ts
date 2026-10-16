// src/app/shared/components/ec-print-return-label/ec-print-return-label.component.ts
//
// "Print return label" link under each ACTIVE loan in the library card (and
// under past loans too when printReturnLabel.showOnPastLoans is on — see ACTIVE
// vs RETURNED below). The link opens, in a new tab, the label page that ships in
// every package (src/assets/return-label/index.html → <package>/assets/return-label/)
// with the loan's library code and the patron's work city:
//   <package>/assets/return-label/index.html?librarycode=BCB&userlocation=BRU&lang=en
// The same page serves the links in library e-mails, so its URL contract lives
// in that file, not here.
//
// SETTINGS (config/global.json, overridable per view; also in the package editor):
//   printReturnLabel.enabled          "Activate" — off = this component renders nothing
//   printReturnLabel.showOnPastLoans  also on returned (history) loans
//   printReturnLabel.label            link text per language
// The return ADDRESSES are not here: they are per library, edited under
// "Return labels" (data/return-labels.json, or the package editor) and read by
// the label page itself.
//
// WHY THE TECHNICAL BITS ARE CONSTANTS (Oct 2026): the label page path, where
// the library code sits on NDE's loan object and how a returned loan is
// recognised are the same for every view and only change when Ex Libris changes
// NDE. They used to be settings (labelPagePath, codePaths, returnedMarker) but
// were confusing for editors and never edited — so they live below, next to the
// code that uses them. If NDE moves the library code: see probe() in the console.
//
// LIBRARY CODE: not in the DOM (the row shows display names only), so it is read
// from the host component NDE injects into this slot (`hostComponent` = the
// nde-loan-item instance). The property path is undocumented and may move
// between NDE releases, so CODE_PATHS are tried in order, then a one-level-deep
// search (findCodeOneLevelDeep). When nothing matches, nothing is rendered and
// the host object is logged ONCE so the right path can be read off the console.
//
// ACTIVE vs RETURNED: the same nde-loan-item renders loan history; those rows
// show a "Return Date" line (RETURNED_MARKER). By default they get no label.
// With `showOnPastLoans` ticked they get one as well — added so the feature can
// be tested without having an active loan. Links on returned rows carry the
// extra class `ec-print-return-label--returned`, so they can be hidden again
// with CSS alone, e.g. in the view's theme.scss:
//     .ec-print-return-label--returned { display: none; }
//
// MOUNT POINT: `nde-loan-item-after` in src/app/shared/shared-mappings.ts (all views).
import { Component, ElementRef, Input, OnInit, inject, signal } from '@angular/core';
import { UserInfoService } from '../../user-info.service';
import { EC_CONFIG, currentLang, localised } from '../../ec-config';

/** Package root at runtime (…/custom/<INST>-<VIEW>/) — same trick as AssetsPublicPathDirective. */
declare const __webpack_public_path__: string;

/**
 * The section object itself (not a copy): runtime-settings.ts merges the
 * package's settings.js INTO it before Angular starts, so reading it here — at
 * file load — still sees the final values.
 */
const CONFIG = EC_CONFIG.printReturnLabel;

/** The label page, relative to the package root. Shipped from src/assets/return-label/. */
const LABEL_PAGE_PATH = 'assets/return-label/index.html';

/**
 * Dot paths on the nde-loan-item host component that may hold the library code,
 * tried in order. Verified (Oct 2026): active loans → loan.mainlocationcode,
 * past loans → result.mainlocationcode. The others are earlier guesses kept
 * because they cost nothing.
 */
const CODE_PATHS = [
  'loan.mainlocationcode',
  'result.mainlocationcode',
  'item.mainlocationcode',
  'loanItem.mainlocationcode',
  'loan.mainLocationCode',
  'item.mainLocationCode',
  'loan.libraryCode',
  'loan.library.code',
];

/** Present only on returned (history) loan rows: NDE's "Return Date" line. */
const RETURNED_MARKER = '[translate="loans.return_date"]';

/** Property names that hold a loan's library code in NDE's loan objects (first match wins). */
const CODE_KEYS = ['mainlocationcode', 'mainLocationCode', 'libraryCode'];

/** Logged once per page load so a wrong path is diagnosed from the console, not by trial builds. */
let probeLogged = false;

@Component({
  selector: 'custom-ec-print-return-label',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-print-return-label' },
  template: `
    @if (href()) {
      <!-- --returned: only on past loans (showOnPastLoans); a CSS hook to hide/style them. -->
      <p class="ec-print-return-label margin-top-medium" [class.ec-print-return-label--returned]="returned()">
        <a [href]="href()" target="_blank" rel="noopener">{{ label }}</a>
      </p>
    }
  `,
  styles: [`
    .ec-print-return-label { margin: 0; }
    .ec-print-return-label a { color: var(--ec-blue, #004494); text-decoration: underline; }
  `],
})
export class EcPrintReturnLabelComponent implements OnInit {
  /** The nde-loan-item instance this slot belongs to (injected by the NDE shell). */
  @Input() hostComponent: any;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly userInfo = inject(UserInfoService);

  readonly label = CONFIG ? localised(CONFIG.label, currentLang()) : '';
  /** Fully built link, or '' when no label should be offered. */
  readonly href = signal('');
  /** True when this row is a returned (history) loan — drives the --returned CSS class. */
  readonly returned = signal(false);

  async ngOnInit(): Promise<void> {
    // "Activate" off (the default in global.json) → nothing at all, not even the probe.
    if (!CONFIG?.enabled) return;

    // History rows are recognised by the "Return Date" line. They get a label
    // only when showOnPastLoans is on; flagged either way so the template can
    // mark the link with the --returned class.
    const row = this.el.nativeElement.closest('nde-account-section-item-container, li');
    const isReturned = !!row?.querySelector(RETURNED_MARKER);
    if (isReturned && !CONFIG.showOnPastLoans) return;
    this.returned.set(isReturned);

    const code = this.libraryCode();
    if (!code) {
      this.probe();
      return;
    }

    // City from the patron's Alma address (address4). Empty is fine: the page
    // then relies on the library code alone.
    const user = await this.userInfo.load();
    const params = new URLSearchParams({ librarycode: code, lang: currentLang() });
    if (user?.city) params.set('userlocation', user.city);

    const base = (typeof __webpack_public_path__ === 'string' ? __webpack_public_path__ : '') || '';
    const root = base && !base.endsWith('/') ? base + '/' : base;
    this.href.set(`${root}${LABEL_PAGE_PATH}?${params.toString()}`);
  }

  /**
   * The loan's library code, e.g. "BCB".
   * 1. CODE_PATHS, in order.
   * 2. Fallback: any plain object directly under the host carrying one of
   *    CODE_KEYS (see findCodeOneLevelDeep) — survives NDE renaming the parent.
   */
  private libraryCode(): string {
    for (const path of CODE_PATHS) {
      const value = path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), this.hostComponent);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return findCodeOneLevelDeep(this.hostComponent);
  }

  /** One-off console dump to find the right property path when nothing matched. */
  private probe(): void {
    if (probeLogged) return;
    probeLogged = true;
    const hc = this.hostComponent ?? {};
    console.warn(
      '[ec] print-return-label: no library code found on hostComponent. ' +
      'Inspect the object below, then add the right path to CODE_PATHS in ' +
      'src/app/shared/components/ec-print-return-label/ec-print-return-label.component.ts.',
      { keys: Object.keys(hc), hostComponent: hc },
    );
  }
}

/**
 * Fallback for libraryCode(): the first CODE_KEYS value found on any plain
 * object directly under `host` (e.g. host.result.mainlocationcode), or ''.
 * Only own enumerable properties, only one level deep, nothing is called — so
 * services/stores on the host are looked at but never walked into.
 */
function findCodeOneLevelDeep(host: any): string {
  if (!host || typeof host !== 'object') return '';
  for (const key of Object.keys(host)) {
    const child = host[key];
    if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
    for (const codeKey of CODE_KEYS) {
      const value = child[codeKey];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return '';
}
