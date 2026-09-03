/**
 * Selector → component pairs applied to EVERY view.
 *
 * Each view's mappings.ts spreads this list first, then adds its own entries.
 * Keep this list to things that are genuinely identical across Find-eR, PUBS,
 * EC Data and Country Knowledge. Anything view-specific goes in src/views/<view>/mappings.ts.
 *
 * Selector naming follows the NDE convention: <host-selector>-{before|after|top|bottom}
 * or the bare host selector to replace it entirely.
 */
import { EcNoticeComponent } from './components/ec-notice/ec-notice.component';

export const sharedSelectorMappings: Array<[string, any]> = [
  // Example: a notice rendered under the search bar on every view.
  // Remove or replace once real shared components exist.
  //['nde-search-bar-after', EcNoticeComponent],
  ['nde-search-bar-container-after', EcNoticeComponent],
];
