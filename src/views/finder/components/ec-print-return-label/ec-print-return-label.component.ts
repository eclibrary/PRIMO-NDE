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
// between NDE releases, so the candidates are listed in config (codePaths) and
// tried in order. When none matches, nothing is rendered and the host object is
// logged ONCE so the right path can be read off the console.
//
// ACTIVE vs RETURNED: the same nde-loan-item renders loan history; those rows
// show a "Return Date" line (translate key loans.return_date) and get no label.
//
// MOUNT POINT: `nde-loan-item-after` in src/views/finder/mappings.ts.
import { Component, ElementRef, Input, OnInit, inject, signal } from '@angular/core';
import { UserInfoService } from '../../../../app/shared/user-info.service';
import { EC_CONFIG, currentLang, localised } from '../../../../app/shared/ec-config';

/** Package root at runtime (…/custom/<INST>-<VIEW>/) — same trick as AssetsPublicPathDirective. */
declare const __webpack_public_path__: string;

/**
 * Settings come from config/views/finder.json (section `printReturnLabel`), merged
 * into EC_CONFIG at build time. The section is optional in the schema because
 * only views that mount this component need it; a view without it renders nothing.
 */
const CONFIG = EC_CONFIG.printReturnLabel;

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

  readonly label = CONFIG ? localised(CONFIG.label, currentLang()) : '';
  /** Fully built link, or '' when no label should be offered. */
  readonly href = signal('');

  async ngOnInit(): Promise<void> {
    if (!CONFIG) return; // section missing from this view's config → feature off

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
    for (const path of CONFIG?.codePaths ?? []) {
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
      'Inspect the object below, then update printReturnLabel.codePaths in config/views/finder.json.',
      { keys: Object.keys(hc), hostComponent: hc },
    );
  }
}
