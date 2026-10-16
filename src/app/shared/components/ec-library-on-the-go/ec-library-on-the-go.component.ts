// src/app/shared/components/ec-library-on-the-go/ec-library-on-the-go.component.ts
//
// COLLECTION BADGES on a record — "Collection badges" in the settings editors.
// Each badge stands for one Alma collection (id, text, colour, explanation are
// settings, libraryOnTheGo.badges[]); a record gets the badge of every
// collection it is in, at the end of its top line:
//
//     JOURNAL | PEER REVIEWED | LIBRARY ON THE GO (i) | OPEN SHELVES (i)
//
// The (i) button opens a dialog explaining the collection (no (i) when the
// explanation is empty).
//
// NAMES: the settings key, class names and file names keep the original name
// (libraryOnTheGo / ec-lotg / EcLibraryOnTheGoComponent) — the EC case this was
// built for: "Library on the Go", titles readable outside the EC network with
// EU Login. Until Oct 2026 there was ONE badge; older settings are converted
// to badges[0] when read (migrateLegacySettings, runtime-settings.ts).
//
// PART OF THE RECORD LINE: EcRecordLineComponent (ec-record-line/) is mounted
// on the NDE slot, finds the record and does the placement and alignment; this
// component only decides which badges apply and draws them. It gets the record
// as `doc` (null while unknown).
//
// HOW A RECORD IS RECOGNISED: PNX field control.colldiscovery lists the
// collections the record is in, one entry per collection, e.g.
//     "$$Titem$$D8183322120004061$$I32EUC_INST"       ($$D = collection id)
// A badge applies when an entry's $$D equals its `collectionId` (exactly —
// "contains" would let one id match inside a longer one).
//
// COLOUR: each badge's `color` (colour picker in the editors; "" = the theme
// colour) is set as --ec-lotg-color on the badge — see the .scss.
//
// The dialog HTML is rendered via [innerHTML], i.e. sanitised by Angular
// (scripts, inline style and data-* attributes are removed; class is kept).
import { Component, Input, OnChanges, ViewEncapsulation, signal } from '@angular/core';
import { EC_CONFIG, EcCollectionBadge, currentLang, localised } from '../../ec-config';
import { RecordDoc } from '../../record-doc';

/** Section may be missing from an older generated config → feature off, no crash. */
const CONFIG = EC_CONFIG.libraryOnTheGo;

/** Counter for unique dialog-title ids (aria-labelledby) — many badges per page. */
let nextId = 0;

/** One badge ready to draw: texts already in the interface language. */
interface ShownBadge {
  label: string;
  /** "" = theme colour (CSS fallback). */
  color: string;
  infoLabel: string;
  dialogTitle: string;
  /** "" = no (i) button. */
  dialogHtml: string;
  titleId: string;
}

@Component({
  selector: 'custom-ec-library-on-the-go',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-library-on-the-go' },
  template: `
    @for (b of shown(); track b.titleId; let first = $first) {
      <span class="ec-lotg" [style.--ec-lotg-color]="b.color || null">
        <!-- Vertical rule, like the one NDE draws before "Peer reviewed". -->
        <span class="ec-lotg__divider" aria-hidden="true"></span>
        <!-- data-ec-align: the record line lines up with the first badge text. -->
        <span class="ec-lotg__label" [attr.data-ec-align]="first ? '' : null">{{ b.label }}</span>
        @if (b.dialogHtml) {
          <!-- (i) — Material Symbols font (loaded by our global styles). -->
          <button type="button" class="ec-lotg__info" [attr.aria-label]="b.infoLabel" (click)="open($event, dlg)">
            <span class="material-symbols-outlined" aria-hidden="true">info</span>
          </button>
        }
      </span>

      <!-- Native <dialog>: focus trap, Esc and backdrop for free. stopPropagation:
           the dialog lives inside the record row, whose click opens the record. -->
      <dialog #dlg class="ec-lotg-dialog" [attr.aria-labelledby]="b.titleId" (click)="onDialogClick($event, dlg)">
        <div class="ec-lotg-dialog__panel">
          <header class="ec-lotg-dialog__bar">
            <h2 class="ec-lotg-dialog__title" [id]="b.titleId">{{ b.dialogTitle }}</h2>
          </header>
          <div class="ec-lotg-dialog__body" [innerHTML]="b.dialogHtml"></div>
          <footer class="ec-lotg-dialog__footer">
            <button type="button" class="ec-lotg-dialog__close" autofocus (click)="dlg.close()">{{ closeLabel }}</button>
          </footer>
        </div>
      </dialog>
    }
  `,
  styleUrls: ['./ec-library-on-the-go.component.scss'],
  // None: the dialog body is injected HTML ([innerHTML]) which emulated
  // encapsulation cannot reach. All rules are prefixed .ec-lotg by hand.
  encapsulation: ViewEncapsulation.None,
})
export class EcLibraryOnTheGoComponent implements OnChanges {
  /** The record of the row (from EcRecordLineComponent); null while unknown. */
  @Input() doc: RecordDoc | null = null;

  /** Badges that apply to this record, in settings order. */
  readonly shown = signal<ShownBadge[]>([]);

  private readonly lang = currentLang();
  readonly closeLabel = CONFIG?.closeLabel ? localised(CONFIG.closeLabel, this.lang) : 'Close';

  /**
   * The badges ready to draw, built once per component: the settings do not
   * change while the page is open. Each keeps a stable titleId.
   */
  private readonly all: Array<{ badge: EcCollectionBadge; view: ShownBadge }> =
    (CONFIG?.enabled && Array.isArray(CONFIG.badges) ? CONFIG.badges : [])
      .filter((b) => b && typeof b.collectionId === 'string' && b.collectionId.trim())
      .map((badge) => ({
        badge,
        view: {
          label: badge.label ? localised(badge.label, this.lang) : '',
          color: typeof badge.color === 'string' ? badge.color.trim() : '',
          infoLabel: badge.infoButtonLabel ? localised(badge.infoButtonLabel, this.lang) : '',
          dialogTitle: badge.dialogTitle ? localised(badge.dialogTitle, this.lang) : '',
          dialogHtml: badge.dialogHtml ? localised(badge.dialogHtml, this.lang) : '',
          titleId: `ec-lotg-title-${nextId++}`,
        },
      }));

  ngOnChanges(): void {
    const ids = collectionIds(this.doc);
    this.shown.set(this.all.filter(({ badge }) => ids.has(badge.collectionId.trim())).map(({ view }) => view));
  }

  open(ev: Event, dialog: HTMLDialogElement): void {
    // Do not let the click reach the record row (it would open the full record).
    ev.stopPropagation();
    ev.preventDefault();
    dialog.showModal();
  }

  /**
   * Clicks inside the dialog must not bubble to the record row either; a click
   * on the <dialog> element itself (not the panel) is a backdrop click → close.
   */
  onDialogClick(ev: MouseEvent, dialog: HTMLDialogElement): void {
    ev.stopPropagation();
    if (ev.target === dialog) dialog.close();
  }
}

/** The collection ids ($$D) in control.colldiscovery, e.g. "$$Titem$$D8183322120004061$$I32EUC_INST". */
function collectionIds(doc: RecordDoc | null): Set<string> {
  const ids = new Set<string>();
  for (const entry of doc?.pnx?.control?.colldiscovery ?? []) {
    const id = /\$\$D([^$]+)/.exec(entry)?.[1];
    if (id) ids.add(id.trim());
  }
  return ids;
}
