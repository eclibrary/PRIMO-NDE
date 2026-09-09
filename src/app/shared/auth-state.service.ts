// src/app/shared/auth-state.service.ts
//
// Single source of truth for "is the current NDE session a guest or a signed-in user?"
//
// HOW IT WORKS
// The NDE shell keeps its application state in an NGRX store, and the
// customModule README documents a `user` feature slice with an `isLoggedIn`
// flag. Because our custom elements are created with the shell's injector,
// `inject(Store)` gives us the *shell's* store, so this signal flips the moment
// the user signs in or out — no polling, no reload needed.
// (EcNoticeComponent used the same selector inline; it now delegates here so
// every component asks the same question in the same way.)
//
// NOTE: this is a UX aid only (which content to show). It is NOT a security
// boundary — anything a guest must not access has to be protected by Alma /
// Primo access rights, never by hiding markup.
import { Injectable, computed, inject } from '@angular/core';
import { Store, createFeatureSelector, createSelector } from '@ngrx/store';

/** Shape of the shell's `user` state slice — only the part we rely on. */
interface UserState {
  isLoggedIn: boolean;
}

// Selectors are module-level constants so they are created once, not per injection.
const selectUserFeature = createFeatureSelector<UserState>('user');
const selectIsLoggedIn = createSelector(selectUserFeature, (s) => s?.isLoggedIn ?? false);

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly store = inject(Store);

  /** True while a real user session exists. Signal — read it as `isSignedIn()`. */
  readonly isSignedIn = this.store.selectSignal(selectIsLoggedIn);

  /** Convenience inverse; guest = anonymous session (nobody signed in). */
  readonly isGuest = computed(() => !this.isSignedIn());

  /**
   * CSS-friendly audience name. Used as the `data-ec-audience` value that
   * markup in homepage/header/footer HTML matches against.
   */
  readonly audience = computed<'guest' | 'user'>(() => (this.isSignedIn() ? 'user' : 'guest'));
}
