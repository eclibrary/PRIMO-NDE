// src/app/shared/network.service.ts
//
// Single source of truth for "is this visitor on the EC network?"
//
// WHY: some content only makes sense inside the Commission network (Intracomm
// links, the EULibCat suggestion, EC-only resources). Primo cannot tell us, so
// we test it ourselves: a resource that only resolves on the EC network
// (setting network.pingUrl, default https://intragate.ec.europa.eu/eclibrarytools/ping)
// is requested with a short timeout.
//   - answered (any HTTP response)      → 'ec'
//   - network error / DNS failure / timeout → 'external'
// `mode: 'no-cors'` because we only care THAT intragate answers, not WHAT it
// answers: the response is opaque, no CORS headers are needed on intragate,
// and nothing about the visitor is sent beyond an ordinary request.
//
// CACHING: the result is kept in sessionStorage for the rest of the browser tab,
// so the ping runs once per tab, not on every page. A laptop that moves between
// networks gets a fresh check in a new tab — or at once with a "Check
// connection" button (data-ec-network-check), which always checks live and
// explains a failure to the visitor (network-check.ts).
//
// THE PING ITSELF (and the reason when it fails) is pingNetwork() in
// network-check.ts, shared by the automatic check and the button.
//
// USING IT
//   - Static HTML (homepage/header/footer): mark elements with
//       data-ec-network="ec"        shown only on the EC network
//       data-ec-network="external"  shown only outside it (and while unknown)
//     EcSessionComponent puts `ec-network-ec` / `ec-network-external` on <html>;
//     the CSS is in styles/_ec-network.scss.
//   - Components: inject(NetworkService) and read `isEcNetwork()` (a signal, so
//     templates/effects update when the check completes) or `status()`.
//     Treat 'unknown' as external: never show EC-only content before we know.
//
// NOTE: a UX aid, NOT a security boundary — anything that must stay internal is
// protected by the target system itself (Intracomm, intragate), not by hiding a link.
//
// CAVEAT: if the NDE page's Content-Security-Policy ever forbids requests to
// intragate (connect-src), the fetch fails like an external visitor and
// everyone is treated as external; the console then shows a CSP error.
import { Injectable, computed, signal } from '@angular/core';
import { EC_CONFIG } from './ec-config';
import { EcNetworkOutcome, pingNetwork, startNetworkCheckButtons } from './network-check';

/** 'unknown' until the check has finished (or when the feature is switched off). */
export type EcNetworkStatus = 'unknown' | 'ec' | 'external';

/** sessionStorage key for the cached result. */
const STORAGE_KEY = 'ec:network';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly state = signal<EcNetworkStatus>('unknown');

  /** 'unknown' | 'ec' | 'external' — signal. */
  readonly status = this.state.asReadonly();

  /** True only when the check confirmed the EC network. Signal. */
  readonly isEcNetwork = computed(() => this.state() === 'ec');

  constructor() {
    void this.check();
    // "Check connection" buttons in the library's HTML (data-ec-network-check,
    // href="#ec-network-check"): a live check on click — see network-check.ts.
    startNetworkCheckButtons(() => this.recheck());
  }

  /** Run the check once per tab (cached result reused). Never throws. */
  private async check(): Promise<void> {
    const cfg = EC_CONFIG.network;
    // Console lines (prefix "[ec] network:") make the check traceable in the
    // browser: which branch ran, and the result. One or two lines per tab.
    if (!cfg?.enabled || !cfg.pingUrl) {
      console.info('[ec] network: check switched off (settings: network) — treating visitor as external');
      // A definite answer, so data-ec-network content shows (_ec-conditional.scss
      // hides it while the status is 'unknown').
      this.state.set('external');
      return;
    }

    const cached = readCache();
    if (cached) {
      console.info(`[ec] network: ${cached} (cached for this tab; a "Check connection" button, or sessionStorage.removeItem('${STORAGE_KEY}') + reload, checks again)`);
      this.state.set(cached);
      return;
    }
    console.info(`[ec] network: checking ${cfg.pingUrl} (timeout ${cfg.timeoutMs || 3000} ms)…`);
    const outcome = await pingNetwork();
    this.apply(outcome);
  }

  /**
   * LIVE check now, ignoring the per-tab cache (the "Check connection"
   * button). Updates the status — and so the <html> classes and every
   * data-ec-network element — and the cache. Never throws.
   * While it runs the previous status stays (no content disappearing and
   * coming back); only the result changes it.
   */
  async recheck(): Promise<EcNetworkOutcome> {
    console.info('[ec] network: live check requested (Check connection)…');
    const outcome = await pingNetwork();
    this.apply(outcome);
    return outcome;
  }

  /** Log, set and cache one outcome. 'off' is not cached (nothing was checked). */
  private apply(o: EcNetworkOutcome): void {
    console.info(`[ec] network: ${o.status} (${o.reason}, ${o.ms} ms) — ${o.detail}`);
    this.state.set(o.status);
    if (o.reason !== 'off') writeCache(o.status);
  }
}

function readCache(): EcNetworkStatus | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v === 'ec' || v === 'external' ? v : null;
  } catch {
    return null; // storage blocked: just check again
  }
}

function writeCache(v: EcNetworkStatus): void {
  try { sessionStorage.setItem(STORAGE_KEY, v); } catch { /* storage blocked: fine */ }
}
