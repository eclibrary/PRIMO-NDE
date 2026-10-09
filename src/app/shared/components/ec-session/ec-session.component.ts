// src/app/shared/components/ec-session/ec-session.component.ts
//
// Headless "session bridge" component. It renders nothing; it exists so that
// STATIC markup (homepage_xx.html, header/footer HTML — files the NDE shell
// injects as plain HTML, with <script> tags stripped) can react to state that
// only our Angular code can see.
//
// It does four things:
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
//     data-ec-query may contain {currentYear} and {lotgCollectionId},
//     replaced at click time (see handleNavClick).
//
//  3. LIVE COUNTS — `<span data-ec-count="CSS selector">` gets the number of
//     elements matching that selector as its text, optionally with a word:
//     data-ec-count-label="country|countries" → "1 country" / "27 countries".
//     Static HTML then never carries hand-typed totals (used by the Country
//     Knowledge region index and headings). Unlike (1), this needs DOM watching:
//     the landing HTML arrives after this component initialises and is
//     re-rendered when the user comes back to the home page.
//
//  4. SUBJECT SCOPE — a data-ec-nav anchor may also carry
//         data-ec-scope="topic,include,Belgium" data-ec-scope-label="Belgium"
//     That facet is then kept on every following search until the user removes
//     it (see SubjectScopeService). Used by the Country Knowledge flag tiles.
//
// In-page jumps (the Country Knowledge region index) are plain `href` links with
// the full page URL before the #fragment — no JS; see that page's header comment.
//
// MOUNT POINT: mapped in shared-mappings.ts on `nde-search-bar-container-after`
// (verified slot, present on the landing page and on results). It only needs
// to exist once per page; it is harmless if the slot renders twice.
import { Component, effect, inject, NgZone, OnDestroy, Renderer2 } from '@angular/core';
import { AuthStateService } from '../../auth-state.service';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { EC_CONFIG, isSandbox } from '../../ec-config';
import { SubjectScopeService } from '../../subject-scope.service';

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

  private readonly zone = inject(NgZone);
  /** Keeps the facet of a clicked scope tile on every following search. */
  private readonly subjectScope = inject(SubjectScopeService);
  /** Watches for static HTML arriving/re-rendering so counts can be (re)filled. */
  private countObserver?: MutationObserver;
  /** True while a fillCounts() run is queued for the next frame (batches mutations). */
  private countQueued = false;

  constructor() {

    // Environment flag: `ec-env-sandbox` on <html> lets CSS mark the sandbox
    // (banner, tinted header) so nobody mistakes it for production. Set once —
    // the host cannot change during a page's life.
    if (isSandbox()) this.renderer.addClass(document.documentElement, 'ec-env-sandbox');


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

    // (3) Live counts. Run once now (the page may already be there), then again
    //     whenever nodes are added/removed anywhere in <body>. Outside Angular's
    //     zone so the shell doesn't run change detection for every DOM mutation.
    this.zone.runOutsideAngular(() => {
      this.countObserver = new MutationObserver(() => this.queueFillCounts());
      this.countObserver.observe(document.body, { childList: true, subtree: true });
    });
    this.queueFillCounts();

    // (4) Subject scope: start watching navigations (idempotent).
    this.subjectScope.start();
  }

  ngOnDestroy(): void {
    document.body.removeEventListener('click', this.onClick, true);
    this.countObserver?.disconnect();
    // Leave the <html> class in place: another instance may be alive, and a
    // stale class is corrected by the next instance's effect anyway.
  }

  /** Coalesce bursts of DOM mutations into one fillCounts() per animation frame. */
  private queueFillCounts(): void {
    if (this.countQueued) return;
    this.countQueued = true;
    requestAnimationFrame(() => {
      this.countQueued = false;
      this.fillCounts();
    });
  }

  /**
   * Write the live count into every `[data-ec-count]` element.
   *
   * - `data-ec-count`       CSS selector whose matches are counted (document-wide).
   * - `data-ec-count-label` optional "singular|plural" word appended to the number.
   *
   * Writing the text is itself a DOM mutation, so the observer fires once more;
   * the equality check below makes that second pass a no-op (no feedback loop).
   */
  private fillCounts(): void {
    document.querySelectorAll<HTMLElement>('[data-ec-count]').forEach((el) => {
      let n: number;
      try {
        n = document.querySelectorAll(el.dataset['ecCount'] ?? '').length;
      } catch {
        return; // invalid selector in the markup — leave the span empty (CSS hides it)
      }
      const [one, many] = (el.dataset['ecCountLabel'] ?? '').split('|');
      const text = one ? `${n} ${n === 1 ? one : (many || one)}` : String(n);
      if (el.textContent !== text) el.textContent = text;
    });
  }

  /**
   * Turn `<a data-ec-nav="account" data-ec-query="section=overview">` into an
   * in-app navigation to `/account?vid=<current>&lang=<current>&section=overview`.
   *
   * Known routes (NDE, Sept 2026): home, search, account, favorites, jsearch,
   * dbsearch, browse, collectionDiscovery (+ collectionId=…, verified Oct 2026). `login` is not a route — sending a guest to `account`
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
    // `append` (not `set`) so repeated keys such as two `facet=` both survive.
    // A key the anchor declares replaces the carried-over value (e.g. its own lang).
    // Placeholders, resolved at click time so static HTML never goes stale:
    //   {currentYear} → e.g. 2026 (from the visitor's clock), used for date
    //   ranges like mfacet=creationdate,include,[2020 TO {currentYear}].
    //   {lotgCollectionId} → the Library on the Go collection id from the
    //   settings (libraryOnTheGo.collectionId), so the landing-page tile and the
    //   record badge can never point at different collections.
    const rawQuery = (anchor.dataset['ecQuery'] ?? '')
      .replace(/\{currentYear\}/g, String(new Date().getFullYear()))
      .replace(/\{lotgCollectionId\}/g, EC_CONFIG.libraryOnTheGo?.collectionId ?? '');
    const extra = new URLSearchParams(rawQuery);
    // Collect the declared keys with forEach: the project's tsconfig has no
    // "dom.iterable" lib, so URLSearchParams.keys() isn't typed here.
    const declared = new Set<string>();
    extra.forEach((_v, k) => declared.add(k));
    declared.forEach((k) => params.delete(k));
    extra.forEach((v, k) => params.append(k, v));

    // (4) A scope tile: remember its facet BEFORE navigating, so the scope
    //     service already knows it when the results page arrives.
    const scopeFacet = anchor.dataset['ecScope'];
    if (scopeFacet) {
      this.subjectScope.set({
        facet: scopeFacet,
        label: anchor.dataset['ecScopeLabel'] || (anchor.textContent ?? '').trim(),
        image: anchor.querySelector('img')?.src, // flag for the chip (absolute URL)
        seedQuery: extra.get('query') ?? undefined, // blanked from the input by the chip
        // Key for the links strip: explicit data-ec-scope-key, else the flag's file
        // name (".../flags/be.svg" → "be").
        key: anchor.dataset['ecScopeKey'] || flagCode(anchor.querySelector('img')?.src),
      });
    }

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

/** ".../assets/images/flags/be.svg" → "be"; undefined when there is no image. */
function flagCode(src: string | undefined): string | undefined {
  return src?.match(/\/([a-z-]+)\.svg(?:[?#].*)?$/i)?.[1]?.toLowerCase();
}
