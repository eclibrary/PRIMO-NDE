// NOTE: relative imports in this file resolve from src/app/custom1-module/ (the file
// this one REPLACES via angular.json fileReplacements), not from src/views/finder/.
// Always write paths as ../../<top-level folder>/… so they work from both places.
import { sharedSelectorMappings } from '../../app/shared/shared-mappings';

export const selectorComponentMap = new Map<string, any>([
  ...sharedSelectorMappings,

  // View-specific mappings for Find-eR: none at the moment.
  // (The "Print return label" link moved to the shared mappings in Oct 2026 and
  // is switched on per view with the setting printReturnLabel.enabled — on for
  // Find-eR in config/views/finder.json.)
]);
