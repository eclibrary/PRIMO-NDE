// NOTE: relative imports in this file resolve from src/app/custom1-module/ (the file
// this one REPLACES via angular.json fileReplacements), not from src/views/finder/.
// Always write paths as ../../<top-level folder>/… so they work from both places.
import { sharedSelectorMappings } from '../../app/shared/shared-mappings';
import { EcPrintReturnLabelComponent } from '../../views/finder/components/ec-print-return-label/ec-print-return-label.component';

export const selectorComponentMap = new Map<string, any>([
  ...sharedSelectorMappings,

  // View-specific mappings for Find-eR:

  // "Print return label" link under each active loan in the library card (VU2 only).
  ['nde-loan-item-after', EcPrintReturnLabelComponent],
]);
