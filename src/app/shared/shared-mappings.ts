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
import { EcNoResultsHelpComponent } from './components/ec-no-results-help/ec-no-results-help.component';
import { EcLibraryOnTheGoComponent } from './components/ec-library-on-the-go/ec-library-on-the-go.component';
// import { EcNoticeComponent } from './components/ec-notice/ec-notice.component';

export const sharedSelectorMappings: Array<[string, any]> = [
  // Root of the shared always-on features (session bridge, Ask-a-librarian modal).
  // Lives on a verified slot present on the landing page and on results pages.
  // If a feature must also work on pages without a search bar (account, full record),
  // move this to a slot that exists everywhere — `nde-header` is a candidate to verify.
  ['nde-search-bar-container-after', EcSharedRootComponent],

  // Resource-sharing request dialog: force the Format per view (config resourceSharing.*).
  // Renders inside the request dialog; hostComponent is the Formly-driven form.
  ['nde-base-request-form-after', EcResourceSharingFormatComponent],

  // "Library on the Go" badge at the end of a record's top line (results list
  // and full record share the markup). nde-record-type is the first element of
  // that line and exists on every record; the component moves itself to the end
  // of the line. Settings: libraryOnTheGo.* (on/off, collection id, texts).
  ['nde-record-type-after', EcLibraryOnTheGoComponent],

  // "Still can't find it?" help under NDE's "No records found" message.
  // nde-search-no-results only exists on a results page without hits.
  // Settings: noResultsHelp.* (on/off, title, HTML text).
  ['nde-search-no-results-after', EcNoResultsHelpComponent],

  // Earlier placeholder that proved the module-federation pipeline. Kept for
  // reference; re-enable on a different slot if you still want it visible.
  // ['nde-search-bar-after', EcNoticeComponent],
];
