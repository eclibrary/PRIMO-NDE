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
// import { EcNoticeComponent } from './components/ec-notice/ec-notice.component';

export const sharedSelectorMappings: Array<[string, any]> = [
  // Root of the shared always-on features (session bridge, Ask-a-librarian modal).
  // Lives on a verified slot present on the landing page and on results pages.
  // If a feature must also work on pages without a search bar (account, full record),
  // move this to a slot that exists everywhere — `nde-header` is a candidate to verify.
  ['nde-search-bar-container-after', EcSharedRootComponent],


];
