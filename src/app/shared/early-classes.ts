// src/app/shared/early-classes.ts
//
// NO JUMPING CONTENT. Parts of the home page, header and footer are shown or
// hidden by classes on <html> (data-ec-audience, data-ec-last-search,
// data-ec-kiosk, data-ec-network). RULE: conditional content is HIDDEN until
// the class that decides it is on <html> — never shown on a guess and then
// swapped. Every condition therefore ends in one of two explicit classes, so
// "not decided yet" (neither class) differs from "no" (the negative class):
//
//   condition        decided by                          classes
//   audience         EcSessionComponent                  ec-audience-guest | ec-audience-user
//   last search      EcLastSearchComponent               ec-has-last-search | ec-no-last-search
//   reading room PC  kiosk.ts (here, early)              ec-kiosk | ec-no-kiosk
//   network          NetworkService / cache (here)       ec-network-ec | ec-network-external
//
// The CSS that hides undecided content: src/app/shared/styles/_ec-conditional.scss.
//
// This file sets what can be known BEFORE Angular starts, at the very start of
// bootstrapRemoteApp (src/bootstrap.ts), before settings.js is fetched:
//   - kiosk mode (URL switch / stored flag)         → ec-kiosk | ec-no-kiosk
//   - network: a result cached by an earlier page   → ec-network-ec | external
//              of this tab, or the check switched off → ec-network-external
// Audience and last search need Angular (NDE's store, the view's settings) and
// are decided by their components a moment later; until then their blocks
// simply are not there yet.
import { EC_CONFIG } from './ec-config';
import { markKioskEarly } from './kiosk';

/** Same key as NetworkService (src/app/shared/network.service.ts). */
const NETWORK_CACHE_KEY = 'ec:network';

/** Classes that can be decided before Angular. Call once, first thing. */
export function setEarlyClasses(): void {
  markKioskEarly();

  const html = document.documentElement;
  const cfg = EC_CONFIG.network;
  let cached: string | null = null;
  try { cached = sessionStorage.getItem(NETWORK_CACHE_KEY); } catch { /* storage blocked */ }
  if (cached === 'ec' || cached === 'external') html.classList.add(`ec-network-${cached}`);
  else if (!cfg?.enabled || !cfg.pingUrl) html.classList.add('ec-network-external'); // no check = external
  // else: the check runs (NetworkService); data-ec-network content waits for its answer.
}
