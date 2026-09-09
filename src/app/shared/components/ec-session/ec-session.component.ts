// src/app/shared/components/ec-session/ec-session.component.ts
//
// Headless "session bridge" component. It renders nothing; it exists so that
// STATIC markup (homepage_xx.html, header/footer HTML — files the NDE shell
// injects as plain HTML, with <script> tags stripped) can react to state that
// only our Angular code can see.
//
// It does two things:
//
//  1. AUDIENCE CLASS — keeps `ec-audience-guest` / `ec-audience-user` on <html>.
//     The CSS in _shared-theme.scss then shows/hides any element carrying
//     `data-ec-audience="guest|user"`. Because it is CSS, it also applies to
//     markup the shell renders *after* this component initialises (the landing
//     page HTML arrives asynchronously), so no DOM watching is needed.
//
//  2. VIEW-AWARE LINKS — static HTML is shared by all four views, so it cannot
//     hard-code `vid=`. Anchors written as
//         <a href="#" data-ec-nav="account" data-ec-query="section=overview">
//     are navigated through the shell router with the current `vid` and `lang`
//     preserved. One delegated click listener on <body> handles them all.
//
// MOUNT POINT: mapped in shared-mappings.ts on `nde-search-bar-container-after`
// (verified slot, present on the landing page and on results). It only needs
// to exist once per page; it is harmless if the slot renders twice.
import { Component, effect, inject, OnDestroy, Renderer2 } from '@angular/core';
import { AuthStateService } from '../../auth-state.service';
import { SHELL_ROUTER } from '../../../injection-tokens';

@Component({
  selector: 'custom-ec-session',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-session' },
  template: '', // intentionally empty — see header comment
})
export class EcSessionComponent implements OnDestroy {
  private readonly auth = inject(AuthStateService);
  private readonly renderer = inject(Renderer2);
  /** The NDE shell's Angular router (documented injection token). */
  private readonly router = inject(SHELL_ROUTER);

  /** Bound once so we can remove exactly this listener on destroy. */
  private readonly onClick = (ev: MouseEvent) => this.handleNavClick(ev);

  constructor() {
    // (1) Reflect the audience on <html>. `effect` re-runs whenever the
    //     store's isLoggedIn flips (sign-in / sign-out), so the page updates
    //     live without a reload.
    effect(() => {
      const html = document.documentElement;
      const audience = this.auth.audience();
      this.renderer.removeClass(html, 'ec-audience-guest');
      this.renderer.removeClass(html, 'ec-audience-user');
      this.renderer.addClass(html, `ec-audience-${audience}`);
    });

    // (2) Delegated click handling for data-ec-nav anchors.
    //     Capture phase so we run before the shell's own handlers.
    document.body.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    document.body.removeEventListener('click', this.onClick, true);
    // Leave the <html> class in place: another instance may be alive, and a
    // stale class is corrected by the next instance's effect anyway.
  }

  /**
   * Turn `<a data-ec-nav="account" data-ec-query="section=overview">` into an
   * in-app navigation to `/account?vid=<current>&lang=<current>&section=overview`.
   *
   * Known routes (NDE, Sept 2026): home, search, account, favorites, jsearch,
   * dbsearch, browse. `login` is not a route — sending a guest to `account`
   * triggers the sign-in prompt, which is what the "Sign in" CTA wants.
   */
  private handleNavClick(ev: MouseEvent): void {
    const anchor = (ev.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-ec-nav]');
    if (!anchor) return;

    ev.preventDefault();
    ev.stopPropagation();

    const route = anchor.dataset['ecNav'];
    if (!route) return;

    // Carry over vid + lang from the current URL so the link works in every view.
    const current = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    for (const key of ['vid', 'lang']) {
      const value = current.get(key);
      if (value) params.set(key, value);
    }
    // Extra params declared on the anchor, e.g. data-ec-query="section=loans".
    new URLSearchParams(anchor.dataset['ecQuery'] ?? '').forEach((v, k) => params.set(k, v));

    const url = `/${route}?${params.toString()}`;
    try {
      // Shell router paths are relative to the /nde base href.
      this.router.navigateByUrl(url);
    } catch {
      // Fallback if the shell router is unavailable for any reason: hard navigate.
      window.location.assign(`/nde${url}`);
    }
  }
}
