// src/app/shared/components/ec-no-results-help/ec-no-results-help.component.ts
//
// "Still can't find it?" — a help block under NDE's "No records found" message.
//
// WHY: a search without results is where patrons give up. NDE already lists
// generic tips there ("check the spelling", "try fewer keywords"); this block
// adds the library's own ways out: the search guide, Ask a librarian, …
//
// WHERE: slot `nde-search-no-results-after` (see shared-mappings.ts).
// nde-search-no-results is the element NDE renders inside nde-search-results
// when a search has zero hits (data-qa="no-search-results"); it does not exist
// on a results page with hits, so this component only ever appears there.
//
// CONTENT: entirely from the settings — EC_CONFIG.noResultsHelp (`npm run
// settings`, section "No results help"): on/off, a title and the body as HTML
// per language. The HTML is rendered through [innerHTML], i.e. sanitised by
// Angular (scripts, inline style and data-* attributes are removed; class,
// href and target survive).
//   - A link to the Ask-a-librarian page opens the modal, as everywhere else
//     (EcAskLibrarianComponent matches on the href — nothing to do here).
//   - Icons: <span class="material-symbols-outlined">icon_name</span>.
import { Component, ViewEncapsulation } from '@angular/core';
import { EC_CONFIG, localised } from '../../ec-config';

/** Section may be missing from an older generated config → feature off, no crash. */
const CONFIG = EC_CONFIG.noResultsHelp;

@Component({
  selector: 'custom-ec-no-results-help',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-no-results-help' },
  template: `
    @if (html) {
      <section class="ec-no-results-help" aria-labelledby="ec-no-results-help-title">
        <h3 id="ec-no-results-help-title" class="ec-no-results-help__title">{{ title }}</h3>
        <div class="ec-no-results-help__body" [innerHTML]="html"></div>
      </section>
    }
  `,
  styleUrls: ['./ec-no-results-help.component.scss'],
  // None: the body is injected HTML, which emulated encapsulation cannot
  // style. Every rule in the stylesheet starts with .ec-no-results-help.
  encapsulation: ViewEncapsulation.None,
})
export class EcNoResultsHelpComponent {
  // Fixed for the life of the page: NDE reloads when the language is switched.
  readonly title = CONFIG ? localised(CONFIG.title) : '';
  /** Empty (→ nothing rendered) when switched off or when there is no text. */
  readonly html = CONFIG?.enabled ? localised(CONFIG.html).trim() : '';
}
