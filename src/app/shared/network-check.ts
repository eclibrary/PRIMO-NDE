// src/app/shared/network-check.ts
//
// NETWORK CHECK — the ping itself, and the "Check connection" button.
//
// 1. pingNetwork() — ONE live check of setting network.pingUrl, with a REASON
//    when it fails. Used by NetworkService (src/app/shared/network.service.ts)
//    for the automatic check (once per tab) and for the button below.
//
//      reason        status     meaning                                  shown to the visitor
//      ------------  ---------  ---------------------------------------  --------------------
//      reached       ec         the address answered                     insideText
//      offline       external   the browser says it has no connection    offlineText
//                               at all (navigator.onLine === false)
//      timeout       external   no answer within network.timeoutMs       outsideText
//      unreachable   external   network error: address unknown outside   outsideText
//                               the network, connection refused, a
//                               firewall / browser extension blocked it,
//                               or the server forbids cross-origin use
//                               (Cross-Origin-Resource-Policy)
//      blocked       external   Primo's Content-Security-Policy forbade  blockedText
//                               the request (securitypolicyviolation
//                               event) — nothing the visitor can fix
//      insecure      external   pingUrl is http:// on an https:// page:  blockedText
//                               browsers refuse that (mixed content)
//      off           external   switched off / no or invalid pingUrl     blockedText
//
//    The browser does not tell a page WHY a request failed (on purpose: it
//    would let pages probe private networks), so "timeout" and "unreachable"
//    cannot be split further — both mean "probably outside the network", and
//    the visitor text lists the likely causes. The exact reason, the time
//    taken and the address are shown under "Technical details" for whoever
//    helps the visitor, and logged in the console ("[ec] network: …").
//
// 2. THE BUTTON — markup in the library's own HTML (home page, header, footer):
//      <button type="button" data-ec-network-check>Check connection</button>
//      <a href="#ec-network-check">Check connection</a>
//    A click runs a LIVE check (the per-tab cache is ignored and then updated),
//    so data-ec-network content and the footer locks follow the new result at
//    once — e.g. after the visitor switched on the VPN. The result is shown:
//      - in every element with data-ec-network-status on the page, if any
//        (place it where you like: <div data-ec-network-status></div>);
//      - otherwise in a box right after the button.
//    The box: "Checking…" while it runs, then a green "connected" line, or an
//    orange message explaining the problem and what to do (texts: settings
//    network.*Text, per language), with "Technical details" folded away, and
//    an × to close it. role="status": screen readers announce the result.
//    Styles: .ec-network-result in styles/_ec-network.scss (colours from the
//    .ec-notice presets in _ec-features.scss).
//
// PLAIN DOM: the click listener is one delegated listener on document, so
// buttons in HTML that NDE draws later (and redraws) work without wiring.
import { EC_CONFIG, Localised, currentLang } from './ec-config';
import { sanitizeHtml } from './sanitize';

export type EcNetworkReason = 'reached' | 'off' | 'offline' | 'insecure' | 'blocked' | 'timeout' | 'unreachable';

/** The result of one live check. */
export interface EcNetworkOutcome {
  status: 'ec' | 'external';
  reason: EcNetworkReason;
  /** Milliseconds the check took (0 when it did not run). */
  ms: number;
  /** One technical line for the console and "Technical details" (English). */
  detail: string;
}

/** Default timeout when the setting is missing. */
const DEFAULT_TIMEOUT = 3000;

/**
 * Run ONE live check now. Never throws. Does not read or write the per-tab
 * cache — that is NetworkService's business.
 */
export async function pingNetwork(): Promise<EcNetworkOutcome> {
  const cfg = EC_CONFIG.network;
  const fail = (reason: EcNetworkReason, detail: string, ms = 0): EcNetworkOutcome =>
    ({ status: 'external', reason, ms, detail });

  // ---- reasons we know before sending anything ------------------------------
  if (!cfg?.enabled || !cfg.pingUrl) return fail('off', 'network check switched off, or no address to ping (settings: Network check)');
  let url: URL;
  try { url = new URL(cfg.pingUrl, window.location.href); } catch { return fail('off', `the address to ping is not a valid web address: ${cfg.pingUrl}`); }
  if (window.location.protocol === 'https:' && url.protocol === 'http:') {
    return fail('insecure', `${url.href} is http:// on an https:// page — browsers block that (mixed content); use an https:// address`);
  }
  if (navigator.onLine === false) return fail('offline', 'the browser reports no network connection at all (navigator.onLine = false)');

  // ---- the request ----------------------------------------------------------
  // A Content-Security-Policy refusal looks like any network error to fetch();
  // the securitypolicyviolation event is the only way to tell them apart.
  let cspBlocked = false;
  const onCsp = (e: SecurityPolicyViolationEvent) => {
    if (e.blockedURI && (e.blockedURI === url.origin || e.blockedURI.startsWith(url.origin))) cspBlocked = true;
  };
  document.addEventListener('securitypolicyviolation', onCsp);

  const timeout = cfg.timeoutMs || DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const started = performance.now();
  try {
    // no-cors: we only care THAT it answers; the (opaque) reply is never read.
    await fetch(url.href, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: controller.signal });
    return { status: 'ec', reason: 'reached', ms: Math.round(performance.now() - started), detail: `${url.href} answered` };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    // The violation event is dispatched asynchronously: give it a moment.
    await new Promise((r) => setTimeout(r, 0));
    if (cspBlocked) {
      return fail('blocked', `${url.origin} is blocked by the page's Content-Security-Policy (connect-src) — only Ex Libris can change that`, ms);
    }
    if ((err as Error)?.name === 'AbortError') return fail('timeout', `no answer from ${url.href} within ${timeout} ms`, ms);
    return fail('unreachable', `${url.href} could not be reached (${(err as Error)?.message || err}): address unknown outside the network, connection refused, `
      + 'blocked by a firewall/proxy/browser extension, or the server forbids cross-origin use (Cross-Origin-Resource-Policy)', ms);
  } finally {
    window.clearTimeout(timer);
    document.removeEventListener('securitypolicyviolation', onCsp);
  }
}

// =============================================================================
// THE "CHECK CONNECTION" BUTTON
// =============================================================================

/** What marks a button / link as a "check connection" trigger. */
const TRIGGER = '[data-ec-network-check], a[href="#ec-network-check"]';
/** Where results go when the page has such elements. */
const STATUS_SLOT = '[data-ec-network-status]';

/**
 * English fallbacks, used when settings.js predates these texts. The real
 * texts (and translations) are settings: network.checkingText etc.
 */
const FALLBACK = {
  checkingText: 'Checking the connection…',
  insideText: '<p>You are connected to our network.</p>',
  outsideText: '<p><strong>You are not connected to our network.</strong></p>'
    + '<p>Possible causes: you are working from outside the building without the VPN, the VPN is not connected (yet), '
    + 'or a browser extension or firewall blocks the check.</p>'
    + '<p>What you can do: connect to the VPN and click the button again. Still not working? Contact the library.</p>',
  offlineText: '<p><strong>Your device is not connected to the internet.</strong></p><p>Check your Wi-Fi or network cable, then try again.</p>',
  blockedText: '<p><strong>The connection could not be checked in this browser.</strong></p><p>Please contact the library and mention the technical details below.</p>',
  detailsLabel: 'Technical details',
  closeLabel: 'Close',
};
type TextKey = keyof typeof FALLBACK;

/** A text of the network section in the current language (→ English → built-in fallback). */
function text(key: TextKey): string {
  const map = (EC_CONFIG.network as Record<string, unknown> | undefined)?.[key] as Localised<string> | undefined;
  if (map && typeof map === 'object') {
    const v = map[currentLang()] || map.en;
    if (v && v.trim()) return v;
  }
  return FALLBACK[key];
}

/** One check at a time, shared by every button on the page. */
let running: Promise<EcNetworkOutcome> | null = null;

/**
 * Start listening for clicks on "check connection" buttons. `recheck` runs a
 * live check and updates the page state (NetworkService.recheck). Call once.
 */
export function startNetworkCheckButtons(recheck: () => Promise<EcNetworkOutcome>): void {
  document.addEventListener('click', (event) => {
    // composedPath: also finds a trigger when the click happened in a shadow root.
    const trigger = event.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && n.matches(TRIGGER));
    if (!trigger) return;
    event.preventDefault(); // a link to #ec-network-check must not change the address
    void runFrom(trigger, recheck);
  });
}

/** Run the check for a click on `trigger` and show progress + result. */
async function runFrom(trigger: HTMLElement, recheck: () => Promise<EcNetworkOutcome>): Promise<void> {
  if (running) return; // a second click while checking: the first result will do
  const boxes = targetsFor(trigger);
  boxes.forEach((b) => showChecking(b));
  trigger.setAttribute('aria-busy', 'true');
  trigger.classList.add('ec-network-checking');
  try {
    running = recheck();
    // Keep "Checking…" up for at least ~0.4 s: on the network the answer can
    // come in a few ms, and a message that flashes by reads as "nothing happened".
    const [outcome] = await Promise.all([running, new Promise((r) => setTimeout(r, 400))]);
    boxes.forEach((b) => showOutcome(b, outcome));
  } finally {
    running = null;
    trigger.removeAttribute('aria-busy');
    trigger.classList.remove('ec-network-checking');
  }
}

/**
 * Where to show the result: the page's [data-ec-network-status] elements, or
 * a box of our own right after the trigger (created on the first click and
 * reused afterwards).
 */
function targetsFor(trigger: HTMLElement): HTMLElement[] {
  const slots = Array.from(document.querySelectorAll<HTMLElement>(STATUS_SLOT));
  if (slots.length) return slots;
  const next = trigger.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains('ec-network-result-host')) return [next];
  const host = document.createElement('div');
  host.className = 'ec-network-result-host';
  trigger.after(host);
  return [host];
}

/** "Checking the connection…" */
function showChecking(host: HTMLElement): void {
  render(host, 'info', 'progress_activity', `<p>${escapeText(text('checkingText'))}</p>`, null);
}

/** The result: green when connected, orange with explanation otherwise. */
function showOutcome(host: HTMLElement, o: EcNetworkOutcome): void {
  const at = new Date().toLocaleTimeString(currentLang(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const details = `${o.reason} · ${o.ms} ms · ${at} — ${o.detail}`;
  switch (o.reason) {
    case 'reached':
      render(host, 'success', 'check_circle', text('insideText'), details);
      break;
    case 'offline':
      render(host, 'warning', 'wifi_off', text('offlineText'), details);
      break;
    case 'timeout':
    case 'unreachable':
      render(host, 'warning', 'lan', text('outsideText'), details);
      break;
    default: // blocked, insecure, off: a set-up problem, not the visitor's
      render(host, 'warning', 'error', text('blockedText'), details);
  }
}

/**
 * Fill `host` with one .ec-notice box (same look as the notice banners).
 * The host is the live region: its content changes, so it is announced.
 */
function render(host: HTMLElement, style: 'info' | 'success' | 'warning', icon: string, html: string, details: string | null): void {
  host.hidden = false;
  host.setAttribute('role', 'status'); // polite live region
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = `ec-notice ec-notice--${style} ec-network-result`;

  const ico = document.createElement('span');
  ico.className = 'material-symbols-outlined ec-notice__icon';
  ico.setAttribute('aria-hidden', 'true');
  ico.textContent = icon;

  const body = document.createElement('div');
  body.className = 'ec-notice__text';
  body.innerHTML = sanitizeHtml(html); // settings text: allow-listed HTML only
  if (details) {
    const d = document.createElement('details');
    d.className = 'ec-network-result__details';
    const s = document.createElement('summary');
    s.textContent = text('detailsLabel');
    const code = document.createElement('code');
    code.textContent = details; // plain text, never HTML
    d.append(s, code);
    body.append(d);
  }
  box.append(ico, body);

  if (details) { // no × while checking
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ec-notice__close';
    close.setAttribute('aria-label', text('closeLabel'));
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    close.addEventListener('click', () => { host.innerHTML = ''; host.hidden = true; });
    box.append(close);
  }
  host.append(box);
}

/** Text → safe HTML (for the one-line "Checking…" text). */
function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
