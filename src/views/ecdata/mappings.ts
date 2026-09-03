/**
 * Component mappings for the EC Data view (32EUC_INST:EC_DATA_NDE).
 *
 * This file replaces src/app/custom1-module/customComponentMappings.ts at build time
 * (see angular.json > configurations > "ecdata" > fileReplacements).
 *
 * - Everything in sharedSelectorMappings is applied to every view.
 * - Add view-specific [selector, Component] pairs below.
 * - A view-specific entry with the same selector as a shared one wins (Map semantics).
 */
import { sharedSelectorMappings } from '../../app/shared/shared-mappings';

export const selectorComponentMap = new Map<string, any>([
  ...sharedSelectorMappings,

  // View-specific mappings for EC Data:
  // ['nde-search-bar-after', FinderSearchTipsComponent],
]);
