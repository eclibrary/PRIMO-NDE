// src/views/finder/components/ec-print-return-label/ec-print-return-label.component.ts
//
// Find-eR only: adds a "Print return label" link under each ACTIVE loan in the
// library card. The link opens, in a new tab, the label page that ships in this
// package (assets/return-label/index.html) with the loan's library code and the
// patron's work city:
//   <package>/assets/return-label/index.html?librarycode=BCB&userlocation=BRU&lang=en
// The same page serves the links in library e-mails, so its URL contract lives
// in that file, not here.
//
// LIBRARY CODE: not in the DOM (the row shows display names only), so it is read
// from the host component NDE injects into this slot (`hostComponent` = the
// nde-loan-item instance). The property path is undocumented and may move
// between NDE releases, so the candidates are listed in CONFIG.codePaths and
// tried in order. When none matches, nothing is rendered and the host object is
// logged ONCE so the right path can be read off the console.
//
// ACTIVE vs RETURNED: the same nde-loan-item renders loan history; those rows
// show a "Return Date" line (translate key loans.return_date) and get no label.
//
// MOUNT POINT: `nde-loan-item-after` in src/views/finder/mappings.ts.
import { Component, ElementRef, Input, OnInit, inject, signal } from '@angular/core';
import { UserInfoService } from '../../../../app/shared/user-info.service';
import { Localised, currentLang, localised } from '../../../../app/shared/ec-config';

/** Package root at runtime (…/custom/<INST>-<VIEW>/) — same trick as AssetsPublicPathDirective. */
declare const __webpack_public_path__: string;

/** View-local config: this feature exists only on Find-eR, so it does not live in EC_CONFIG. */
const CONFIG = {
  /** Label page inside this package (see src/views/finder/assets/return-label/). */
  labelPagePath: 'assets/return-label/index.html',
  /**
   * Where to look for the loan's library (main location) code on the host
   * component, most likely first. Dot paths, evaluated against hostComponent.
   * VE exposed it as `item.mainlocationcode` on prm-loan; NDE's loan object comes
   * from the same Alma loans payload, so the field name should survive.
   */
  codePaths: [
    'loan.mainlocationcode',
    'item.mainlocationcode',
    'loanItem.mainlocationcode',
    'loan.mainLocationCode',
    'item.mainLocationCode',
    'loan.libraryCode',
    'loan.library.code',
  ],
  /** Selector that marks a returned (history) loan row. */
  returnedMarker: '[translate="loans.return_date"]',
  label: { en: 'Print return label', fr: "Imprimer l'étiquette de retour" } as Localised,
};

/** Logged once per page load so a wrong path is diagnosed from the console, not by trial builds. */
let probeLogged = false;

@Component({
  selector: 'custom-ec-print-return-label',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-print-return-label' },
  template: `
    @if (href()) {
      <p class="ec-print-return-label margin-top-medium">
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

  readonly label = localised(CONFIG.label, currentLang());
  /** Fully built link, or '' when no label should be offered. */
  readonly href = signal('');

  async ngOnInit(): Promise<void> {
    // History rows: no label.
    const row = this.el.nativeElement.closest('nde-account-section-item-container, li');
    if (row?.querySelector(CONFIG.returnedMarker)) return;

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
    this.href.set(`${root}${CONFIG.labelPagePath}?${params.toString()}`);
  }

  /** First candidate path on hostComponent that yields a non-empty string. */
  private libraryCode(): string {
    for (const path of CONFIG.codePaths) {
      const value = path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), this.hostComponent);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  /** One-off console dump to find the right property path when none of codePaths matched. */
  private probe(): void {
    if (probeLogged) return;
    probeLogged = true;
    const hc = this.hostComponent ?? {};
    console.warn(
      '[ec] print-return-label: no library code found on hostComponent. ' +
      'Inspect the object below, then update CONFIG.codePaths.',
      { keys: Object.keys(hc), hostComponent: hc },
    );
  }
}
