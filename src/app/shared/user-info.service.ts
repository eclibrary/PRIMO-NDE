// src/app/shared/user-info.service.ts
//
// Fetches the signed-in patron's details (name, e-mail, …) from Primo, for
// features that need them — currently prefilling the Ask-a-librarian form.
//
// HOW: the NDE shell talks to private Primo REST endpoints under /primaws/rest/priv/
// with the session JWT as a Bearer token. We do the same with `fetch`, on the
// same origin, so cookies/JWT and CORS are a non-issue. Endpoint, JWT storage
// key and response mapping are all in EC_CONFIG.userInfo so they can be
// corrected without touching this code once verified against the real shell.
//
// Guests: resolves to null immediately, no request made.
// Failures: resolve to null (features degrade to "no prefill"), never throw.
// Caching: one result per session sign-in state; a sign-out/sign-in clears it.
import { Injectable, effect, inject } from '@angular/core';
import { AuthStateService } from './auth-state.service';
import { EC_CONFIG, EcUserInfo, currentLang, currentVid } from './ec-config';

@Injectable({ providedIn: 'root' })
export class UserInfoService {
  private readonly auth = inject(AuthStateService);

  /** In-flight or resolved lookup; null = not fetched yet. */
  private cached: Promise<EcUserInfo | null> | null = null;

  constructor() {
    // Invalidate the cache whenever sign-in state changes, so a user who signs
    // out and another who signs in never share details.
    effect(() => {
      this.auth.isSignedIn(); // read → tracked
      this.cached = null;
    });
  }

  /** Patron details for the current session, or null for guests / on failure. */
  load(): Promise<EcUserInfo | null> {
    if (!this.auth.isSignedIn()) return Promise.resolve(null);
    if (!this.cached) this.cached = this.fetchUser();
    return this.cached;
  }

  private async fetchUser(): Promise<EcUserInfo | null> {
    const cfg = EC_CONFIG.userInfo;
    const url = cfg.endpoint
      .replace('{vid}', encodeURIComponent(currentVid()))
      .replace('{lang}', encodeURIComponent(currentLang()));

    const headers: Record<string, string> = { Accept: 'application/json' };
    const jwt = this.readJwt(cfg.jwtStorageKey);
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    try {
      const res = await fetch(url, { headers, credentials: 'same-origin' });
      if (!res.ok) {
        console.warn(`[ec] user info request failed: ${res.status} ${url}`);
        return null;
      }
      const info = cfg.mapResponse(await res.json());
      // Primary id from the JWT is a cheap fallback if the endpoint omits it.
      if (!info.primaryId && jwt) info.primaryId = this.jwtClaim(jwt, 'userName');
      return info;
    } catch (err) {
      console.warn('[ec] user info request errored', err);
      return null;
    }
  }

  /** The raw JWT string; Primo stores it JSON-stringified (with quotes) in sessionStorage. */
  private readJwt(key: string): string | null {
    try {
      const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
      return raw ? raw.replace(/^"|"$/g, '') : null;
    } catch {
      return null;
    }
  }

  /** Read one claim from the JWT payload without verifying (we only need to display it). */
  private jwtClaim(jwt: string, claim: string): string | undefined {
    try {
      const payload = jwt.split('.')[1] ?? '';
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return json?.[claim] || undefined;
    } catch {
      return undefined;
    }
  }
}
