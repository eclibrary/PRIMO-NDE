// src/app/shared/kiosk.ts
//
// READING ROOM ("kiosk") MODE — for shared PCs where one visitor must never see
// what the previous one did.
//
// SWITCHING IT ON/OFF — per PC, by URL, remembered in localStorage:
//   …/nde/home?vid=32EUC_INST:VU2&lang=en&ec_kiosk=1   → kiosk mode ON for this browser
//   …/nde/home?vid=32EUC_INST:VU2&lang=en&ec_kiosk=0   → OFF again (flag removed)
// Give the reading room PCs a start page / shortcut with &ec_kiosk=1. The flag
// (localStorage key KIOSK_KEY = "1") then stays until a URL with ec_kiosk=0 is
// opened on that PC, whatever later URLs look like.
//
// WHAT KIOSK MODE DOES
//   1. No feature of ours stores anything in localStorage while the flag is set
//      — the flag itself is the only key. Components ask isKiosk():
//        - EcLastSearchComponent    "Pick up where you left off": not recorded, not shown
//        - EcAccountCountsComponent loans/saved records/searches: live counts for the
//                                   signed-in patron only; nothing remembered for guests
//        - EcWelcomeMessageComponent no "Don't show this message again" box; the message
//                                   shows again for every new browser session
//      Switching kiosk ON also deletes whatever those features stored before
//      (purgeEcLocalStorage), so nothing from before the switch survives.
//   2. IDLE RESET: after `kiosk.idleMinutes` (setting, default 60) without any
//      mouse, keyboard, touch or scroll activity, the browser tab is reset:
//      sessionStorage is cleared — which also drops Primo's session token, i.e.
//      the previous patron is signed out in this browser — and the Find-eR home
//      page is reloaded. Only after the page was actually USED since it was
//      loaded, so an unused PC is not reloaded every hour all night.
//      ONE MINUTE BEFORE the reset a small dialog warns "Are you still there?"
//      with a countdown and a Continue button (texts: settings kiosk.warning*);
//      any mouse, keyboard, touch or scroll activity closes it and restarts the clock.
//   3. VISUAL CUE: `ec-kiosk` is put on <html>; the header HTML carries a badge
//      (`<span data-ec-kiosk>`) that the CSS in _ec-header.scss only shows then.
//      Inside it, `<span data-ec-kiosk-minutes>` gets the configured minutes, so
//      the badge text always matches the setting.
//
// NOT COVERED (do it on the PC/browser side): an EU Login session cookie can
// outlive our reset, so the next visitor clicking "Sign in" might be signed in
// as the previous one without a password. Configure the reading room browsers
// to clear cookies/history on exit (or use private mode), and log out of EU
// Login when closing.
//
// WHY A PLAIN MODULE (not an Angular service): it must run on EVERY page,
// including account and full-record pages where EcSharedRootComponent is not
// mounted. shared-mappings.ts imports this file, and the mappings are loaded
// with the custom module on every page, so the code below runs at start-up.
import { EC_CONFIG, currentLang, currentVid, localised } from './ec-config';

/** localStorage key of the kiosk flag ("1" = on). */
export const KIOSK_KEY = 'ec:kiosk';
/** URL parameter that switches the flag: ec_kiosk=1 / ec_kiosk=0. */
const URL_PARAM = 'ec_kiosk';

/** Evaluated once, at start-up (see applyUrlSwitch below). */
let kiosk = false;

/** True on a PC switched to reading room mode. Cheap — read it anywhere. */
export function isKiosk(): boolean {
  return kiosk;
}

/**
 * Delete everything OUR features keep in localStorage (never Primo's own keys).
 * Prefixes come from the settings where they are configurable.
 */
export function purgeEcLocalStorage(): void {
  const prefixes = [
    EC_CONFIG.lastSearch?.storageKeyPrefix,    // "Pick up where you left off"
    EC_CONFIG.accountCounts?.storageKeyPrefix, // account counts
    'ec:welcomeMessage:',                      // welcome message dismissals
  ].filter((p): p is string => !!p);
  try {
    // Collect first, delete after: removing while iterating shifts the indexes.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== KIOSK_KEY && prefixes.some((p) => k.startsWith(p))) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
    if (doomed.length) console.info(`[ec] kiosk: removed ${doomed.length} stored item(s) from earlier visitors`);
  } catch { /* storage blocked: nothing stored either */ }
}

/** Read ec_kiosk from the URL and the stored flag; set `kiosk`. */
function applyUrlSwitch(): void {
  try {
    const param = new URLSearchParams(window.location.search).get(URL_PARAM);
    if (param === '1') {
      localStorage.setItem(KIOSK_KEY, '1');
      console.info('[ec] kiosk: reading room mode switched ON for this browser (ec_kiosk=0 switches it off)');
    } else if (param === '0') {
      localStorage.removeItem(KIOSK_KEY);
      console.info('[ec] kiosk: reading room mode switched OFF for this browser');
    }
    kiosk = localStorage.getItem(KIOSK_KEY) === '1';
  } catch {
    kiosk = false; // storage blocked → cannot remember the flag → normal mode
  }
  if (kiosk) purgeEcLocalStorage(); // every start-up in kiosk mode: nothing left behind
}

/** Configured idle time in minutes (setting kiosk.idleMinutes; 0 = no reset). */
function idleMinutes(): number {
  const m = EC_CONFIG.kiosk?.idleMinutes;
  return typeof m === 'number' && m >= 0 ? m : 60;
}

/** Seconds of warning before the reset (the dialog's countdown). */
const WARNING_SECONDS = 60;

/** Idle reset with a warning — see header, point 2. */
function startIdleReset(): void {
  const minutes = idleMinutes();
  if (!minutes) return; // 0 = idle reset off

  const limit = minutes * 60 * 1000;
  // No warning when the idle time is too short to make sense of one (tests).
  const warnAfter = limit > 2 * WARNING_SECONDS * 1000 ? limit - WARNING_SECONDS * 1000 : 0;
  let used = false;          // any activity since this page was loaded?
  let warnTimer = 0;
  let resetTimer = 0;

  const reset = () => {
    if (!used) { arm(); return; } // nobody used it: nothing to wipe, keep waiting
    console.info(`[ec] kiosk: ${minutes} min without activity — clearing the session and returning to the home page`);
    try { sessionStorage.clear(); } catch { /* ignore */ }
    purgeEcLocalStorage();
    // Full reload (not a router navigation) so NDE drops its in-memory state too.
    const params = new URLSearchParams();
    const vid = currentVid();
    if (vid) params.set('vid', vid);
    params.set('lang', currentLang());
    window.location.assign(`/nde/home?${params.toString()}`);
  };
  const arm = () => {
    window.clearTimeout(warnTimer);
    window.clearTimeout(resetTimer);
    if (warnAfter) warnTimer = window.setTimeout(() => { if (used) showWarning(); }, warnAfter);
    resetTimer = window.setTimeout(reset, limit);
  };
  const onActivity = () => {
    used = true;
    hideWarning();
    arm();
  };

  // Capture + passive: we only observe, never interfere with the page.
  // pointermove counts too: someone moving the mouse while reading is present.
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    window.addEventListener(ev, onActivity, { capture: true, passive: true });
  }
  arm();
}

// ------------------------------------------------------------ warning dialog
//
// Plain DOM (no Angular): this file runs on every page, also where none of our
// components is mounted. Styles are injected once, scoped to #ec-kiosk-warning.

let warningEl: HTMLDialogElement | null = null;
let countdown = 0;

function showWarning(): void {
  const cfg = EC_CONFIG.kiosk;
  if (!warningEl) warningEl = buildWarning();
  if (warningEl.open) return;
  const title = warningEl.querySelector<HTMLElement>('.ec-kw__title')!;
  const text = warningEl.querySelector<HTMLElement>('.ec-kw__text')!;
  const button = warningEl.querySelector<HTMLButtonElement>('.ec-kw__btn')!;
  title.textContent = cfg?.warningTitle ? localised(cfg.warningTitle) : 'Are you still there?';
  button.textContent = cfg?.continueLabel ? localised(cfg.continueLabel) : 'Continue';
  const template = cfg?.warningText ? localised(cfg.warningText) : 'For privacy, this session will be cleared in {s} seconds.';

  let left = WARNING_SECONDS;
  const tick = () => { text.textContent = template.replace('{s}', String(left)); left = Math.max(0, left - 1); };
  tick();
  window.clearInterval(countdown);
  countdown = window.setInterval(tick, 1000);
  try { warningEl.showModal(); } catch { warningEl.setAttribute('open', ''); }
}

function hideWarning(): void {
  window.clearInterval(countdown);
  if (warningEl?.open) warningEl.close();
}

function buildWarning(): HTMLDialogElement {
  const style = document.createElement('style');
  style.textContent = `
    #ec-kiosk-warning { border: 0; border-radius: .75rem; padding: 0; width: min(26rem, calc(100vw - 2rem));
      box-shadow: 0 1.5rem 3rem rgba(0,0,0,.3); font: 1rem/1.5 Arial, sans-serif; color: #1b1b1b; }
    #ec-kiosk-warning::backdrop { background: rgba(0,0,0,.45); }
    #ec-kiosk-warning .ec-kw__bar { background: #004494; color: #fff; padding: .9rem 1.25rem; }
    #ec-kiosk-warning .ec-kw__title { margin: 0; font: 600 1.125rem/1.3 Arial, sans-serif; color: #fff; }
    #ec-kiosk-warning .ec-kw__text { margin: 0; padding: 1.25rem; }
    #ec-kiosk-warning .ec-kw__foot { display: flex; justify-content: flex-end; padding: 0 1.25rem 1.25rem; }
    #ec-kiosk-warning .ec-kw__btn { padding: .5rem 1.25rem; border: 0; border-radius: 1.25rem; background: #004494;
      color: #fff; font: 600 .95rem/1.3 Arial, sans-serif; cursor: pointer; }
    #ec-kiosk-warning .ec-kw__btn:focus-visible { outline: 3px solid #1b1b1b; outline-offset: 2px; }`;
  document.head.appendChild(style);

  const dlg = document.createElement('dialog');
  dlg.id = 'ec-kiosk-warning';
  dlg.setAttribute('aria-labelledby', 'ec-kw-title');
  dlg.innerHTML = `
    <div class="ec-kw__bar"><h2 class="ec-kw__title" id="ec-kw-title"></h2></div>
    <p class="ec-kw__text" aria-live="polite"></p>
    <div class="ec-kw__foot"><button type="button" class="ec-kw__btn" autofocus></button></div>`;
  // The click itself counts as activity (pointerdown listener) and closes the
  // dialog; the explicit handler covers keyboard "Enter" on the button too.
  dlg.querySelector('button')!.addEventListener('click', () => hideWarning());
  dlg.addEventListener('cancel', () => window.clearInterval(countdown)); // Esc
  document.body.appendChild(dlg);
  return dlg;
}

// -------------------------------------------------------------- visual cue

/**
 * Put `ec-kiosk` on <html> and keep [data-ec-kiosk-minutes] in the header filled.
 *
 * This code runs very early — before the NDE shell has finished starting — and
 * the shell may rewrite the class list of <html> while it starts (seen: the
 * badge stayed hidden because the class was gone). So the class is not set
 * once but RE-ASSERTED whenever <html>'s class attribute changes, and on every
 * DOM change that could bring in the header.
 */
function showVisualCue(): void {
  const html = document.documentElement;
  const minutes = String(idleMinutes());
  const apply = () => {
    if (!html.classList.contains('ec-kiosk')) html.classList.add('ec-kiosk');
    document.querySelectorAll<HTMLElement>('[data-ec-kiosk-minutes]').forEach((el) => {
      if (el.textContent !== minutes) el.textContent = minutes;
    });
  };
  apply();
  // Batched per animation frame; the checks above make our own writes no-ops
  // on the next pass, so there is no feedback loop.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }).observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

// ---- start-up (runs once, when this module is first imported) -------------
applyUrlSwitch();
if (kiosk) {
  showVisualCue();
  startIdleReset();
}
