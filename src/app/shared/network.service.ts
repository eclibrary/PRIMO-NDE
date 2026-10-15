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
// networks gets a fresh check in a new tab.
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
  }

  /** Run the check once per tab (cached result reused). Never throws. */
  private async check(): Promise<void> {
    const cfg = EC_CONFIG.network;
    // Console lines (prefix "[ec] network:") make the check traceable in the
    // browser: which branch ran, and the result. One or two lines per tab.
    if (!cfg?.enabled || !cfg.pingUrl) {
      console.info('[ec] network: check switched off (settings: network) — treating visitor as external');
      return; // stays 'unknown' (= external)
    }

    const cached = readCache();
    if (cached) {
      console.info(`[ec] network: ${cached} (cached for this tab; run sessionStorage.removeItem('${STORAGE_KEY}') and reload to re-check)`);
      this.state.set(cached);
      return;
    }
    console.info(`[ec] network: checking ${cfg.pingUrl} (timeout ${cfg.timeoutMs || 3000} ms)…`);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), cfg.timeoutMs || 3000);
    let result: EcNetworkStatus;
    try {
      // Any response at all (opaque in no-cors mode) means intragate is reachable.
      await fetch(cfg.pingUrl, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: controller.signal });
      result = 'ec';
    } catch (err) {
      result = 'external'; // DNS failure, refused, blocked (e.g. CSP) or timed out
      console.info('[ec] network: no answer —', (err as Error)?.name === 'AbortError' ? 'timed out' : err);
    } finally {
      window.clearTimeout(timer);
    }
    console.info(`[ec] network: ${result}`);
    this.state.set(result);
    writeCache(result);
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
