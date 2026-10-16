// src/noob/core/mappings.ts
//
// Component mappings of the NOOB ZIP's core (scripts/build-noob.cjs) — the
// package handed to institutions WITHOUT a developer. Replaces
// src/app/custom1-module/customComponentMappings.ts for the "noob" build
// configuration in angular.json (written by build-noob.cjs).
//
// WHY NOT sharedSelectorMappings AS A WHOLE: some shared mappings carry EC
// rules that make no sense elsewhere:
//   - EcResourceSharingFormatComponent forces the EC's "digital" format in the
//     resource-sharing request form;
//   - EcPrintReturnLabelComponent prints EC internal-post labels (EC library
//     codes, EC wording in the label page) — not shipped in the noob zip.
// Page-wide features without Angular (notice banners, opening hours, scheduled
// content, reading room mode) are not mapped: bootstrap.ts starts them.
// Everything listed here is generic and driven by settings.js, with neutral
// defaults in config/noob.json (features with EC values are off).
//
// NOTE: this file sits at the same depth as src/app/custom1-module/ (three
// levels under the repo root) ON PURPOSE: relative imports in a replacement
// file resolve from the file it replaces, so ../../app/… works from both
// places. It is NOT under src/views/, where `views:remove --orphans` would
// treat it as a leftover view folder.
import { EcNoobRootComponent } from '../../noob/core/noob-root.component';
import { EcRecordLineComponent } from '../../app/shared/components/ec-record-line/ec-record-line.component';

export const selectorComponentMap = new Map<string, any>([
  // Always-on features (session classes, welcome message, Ask-a-librarian
  // modal and LibChat when configured, last search, …) — EcSharedRootComponent
  // without the EC country-scope pieces, see noob-root.component.ts.
  ['nde-search-bar-container-after', EcNoobRootComponent],
  // Record top line: collection badges and the "Free version" link
  // (Unpaywall) — both off by default.
  ['nde-record-type-after', EcRecordLineComponent],
]);
