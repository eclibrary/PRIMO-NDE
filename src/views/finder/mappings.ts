/**
 * Component mappings for the Find-eR view (32EUC_INST:VU2).
 *
 * This file replaces src/app/custom1-module/customComponentMappings.ts at build time
 * (see angular.json > configurations > "finder" > fileReplacements).
 *
 * - Everything in sharedSelectorMappings is applied to every view.
 * - Add view-specific [selector, Component] pairs below.
 * - A view-specific entry with the same selector as a shared one wins (Map semantics).
 */
import { sharedSelectorMappings } from '../../app/shared/shared-mappings';

export const selectorComponentMap = new Map<string, any>([
  ...sharedSelectorMappings,

  // View-specific mappings for Find-eR:
  // ['nde-search-bar-after', FinderSearchTipsComponent],
]);
