// Fallback used only when building WITHOUT a view configuration (plain `ng build`).
// With `npm run build -- <view>` this file is replaced by src/views/<view>/mappings.ts
// via angular.json fileReplacements.
import { sharedSelectorMappings } from '../shared/shared-mappings';

export const selectorComponentMap = new Map<string, any>([...sharedSelectorMappings]);
