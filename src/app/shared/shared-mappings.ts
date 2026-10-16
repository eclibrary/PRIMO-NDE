/**
 * Selector → component pairs applied to EVERY view.
 *
 * Each view's mappings.ts spreads this list first, then adds its own entries.
 * Keep this list to things that are genuinely identical across Find-eR, PUBS,
 * EC Data and Country Knowledge. Anything view-specific goes in src/views/<view>/mappings.ts.
 *
 * Selector naming follows the NDE convention: <host-selector>-{before|after|top|bottom}
 * or the bare host selector to replace it entirely.
 *
 * NOTE: the map holds ONE component per selector. Shared page-level features
 * therefore hang off EcSharedRootComponent rather than each taking a slot.
 */
import { EcSharedRootComponent } from './components/ec-shared-root/ec-shared-root.component';
import { EcResourceSharingFormatComponent } from './components/ec-resource-sharing-format/ec-resource-sharing-format.component';
import { EcPrintReturnLabelComponent } from './components/ec-print-return-label/ec-print-return-label.component';
import { EcRecordLineComponent } from './components/ec-record-line/ec-record-line.component';
// import { EcNoticeComponent } from './components/ec-notice/ec-notice.component';

export const sharedSelectorMappings: Array<[string, any]> = [
  // Root of the shared always-on features (session bridge, Ask-a-librarian modal).
  // Lives on a verified slot present on the landing page and on results pages.
  // If a feature must also work on pages without a search bar (account, full record),
  // move this to a slot that exists everywhere — `nde-header` is a candidate to verify.
  ['nde-search-bar-container-after', EcSharedRootComponent],

  // Resource-sharing request dialog: force the Format (rules in the component, not in the settings).
  // Renders inside the request dialog; hostComponent is the Formly-driven form.
  ['nde-base-request-form-after', EcResourceSharingFormatComponent],

  // Our additions at the end of a record's top line (results list and full
  // record share the markup): collection badges ("Library on the Go"; settings
  // libraryOnTheGo) and the "Free version" link (settings openAccess, Unpaywall).
  // nde-record-type is the first element of that line and exists on every
  // record; EcRecordLineComponent moves itself to the end of the line and hosts both.
  ['nde-record-type-after', EcRecordLineComponent],

  // "Print return label" link under each loan in the library card. Mounted in
  // every view, but renders nothing unless the view's setting
  // printReturnLabel.enabled ("Activate") is on — Find-eR only for now.
  // hostComponent is the nde-loan-item instance (the library code is read from it).
  ['nde-loan-item-after', EcPrintReturnLabelComponent],

  // Earlier placeholder that proved the module-federation pipeline. Kept for
  // reference; re-enable on a different slot if you still want it visible.
  // ['nde-search-bar-after', EcNoticeComponent],
];
