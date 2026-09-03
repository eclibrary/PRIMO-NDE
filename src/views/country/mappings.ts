/**
 * Component mappings for the Country Knowledge view (32EUC_INST:COUNTRY_KNOWLEDGE).
 *
 * This file replaces src/app/custom1-module/customComponentMappings.ts at build time
 * (see angular.json > configurations > "country" > fileReplacements).
 *
 * - Everything in sharedSelectorMappings is applied to every view.
 * - Add view-specific [selector, Component] pairs below.
 * - A view-specific entry with the same selector as a shared one wins (Map semantics).
 */
import { sharedSelectorMappings } from '../../app/shared/shared-mappings';

export const selectorComponentMap = new Map<string, any>([
  ...sharedSelectorMappings,

  // View-specific mappings for Country Knowledge:
  // ['nde-search-bar-after', FinderSearchTipsComponent],
]);
