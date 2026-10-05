// src/app/shared/components/ec-scope-backdrop/ec-scope-backdrop.component.ts
//
// Decorative backdrop: while a country scope is active on the results page,
// the country's flag is shown as a faint, window-wide wash from just under the
// top navigation down to the bottom of the window — a quiet "you are in
// Belgium" cue next to the chip and the strip.
//
// PLACEMENT (v2, Oct 2026): full window width; the top edge follows the bottom
// of NDE's main navigation (measured, also while scrolling), so the flag never
// sits behind the header. It fades out towards the bottom.
//
//   - Purely decorative: aria-hidden, pointer-events: none, never above content.
//   - Uses the flag already stored with the scope (SubjectScope.image); no data.
//   - Hidden when printing; the fade-in is skipped for prefers-reduced-motion.
//
// TUNING — everything visual is in CSS custom properties at the top of the
// injected stylesheet (see BACKDROP_CSS):
//   --ec-flag-opacity  how visible (0.04 subtle … 0.12 obvious)
//   --ec-flag-blur     softens busy flags with coats of arms (0px … 6px)
//   --ec-flag-tilt     optional 3D turn around the vertical axis (0deg = flat)
//   --ec-flag-lean     optional 3D turn around the horizontal axis (0deg = flat)
//   --ec-flag-fade     where the downward fade reaches fully transparent
//
// LAYER MODE (LAYER constant below)
//   'over' (default) — on top of everything, blended with `multiply`: white and
//            light areas get a faint tint of the flag, dark text stays dark.
//   'behind' — under the page content. In real NDE this is INVISIBLE: NDE's
//            containers paint an opaque background over the whole page
//            (verified Oct 2026), so it's kept only for completeness.
//
// Removing the feature: delete this folder and its <custom-ec-scope-backdrop>
// line (+ import) in ec-shared-root.component.ts. Nothing else depends on it.
//
// MOUNT POINT: EcSharedRootComponent (slot `nde-search-bar-container-after`).
import { Component, NgZone, OnDestroy, inject } from '@angular/core';
import { EventType } from '@angular/router';
import { Subscription } from 'rxjs';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { SubjectScopeService } from '../../subject-scope.service';

/** 'behind' = under the content (default); 'over' = blended on top. See header. */
const LAYER: 'behind' | 'over' = 'over';

/** NDE's main navigation; the backdrop starts right below it. */
const NAV_SELECTOR = 'nav[aria-label="Main Menu Region"]';

/** Class of the backdrop element. */
const BACKDROP_CLASS = 'ec-scope-backdrop';

@Component({
  selector: 'custom-ec-scope-backdrop',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-scope-backdrop' },
  template: '', // headless — the backdrop is a fixed element on <body>
})
export class EcScopeBackdropComponent implements OnDestroy {
  private readonly scope = inject(SubjectScopeService);
  private readonly router = inject(SHELL_ROUTER);
  private readonly zone = inject(NgZone);

  private observer?: MutationObserver;
  private routerSub?: Subscription;
  /** Bound once; keeps the top edge under the navigation while scrolling. */
  private readonly onScrollOrResize = () => this.queueSync();
  /** True while a sync() is queued for the next animation frame. */
  private queued = false;

  constructor() {
    injectStylesOnce();

    // Same triggers as the chip: navigations, and DOM changes (NDE re-renders
    // the results after every search, also for URL changes without a router
    // event). Outside Angular's zone: pure DOM work.
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => this.queueSync());
      this.observer.observe(document.body, { childList: true, subtree: true });
      this.routerSub = this.router.events.subscribe((e) => {
        if ((e as { type?: number }).type === EventType.NavigationEnd) this.queueSync();
      });
      // Capture phase: NDE scrolls inner containers too, not only the window.
      window.addEventListener('scroll', this.onScrollOrResize, { capture: true, passive: true });
      window.addEventListener('resize', this.onScrollOrResize, { passive: true });
    });
    this.queueSync();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routerSub?.unsubscribe();
    window.removeEventListener('scroll', this.onScrollOrResize, { capture: true });
    window.removeEventListener('resize', this.onScrollOrResize);
    document.querySelector(`.${BACKDROP_CLASS}`)?.remove();
  }

  /** Coalesce bursts of triggers into one sync() per frame. */
  private queueSync(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.sync();
    });
  }

  /** Show the active scope's flag, swap it when the country changes, or remove it. */
  private sync(): void {
    const scope = this.scope.activeOnResults();
    let el = document.querySelector<HTMLElement>(`.${BACKDROP_CLASS}`);

    if (!scope?.image) {
      el?.remove();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.className = `${BACKDROP_CLASS} ${BACKDROP_CLASS}--${LAYER}`;
      el.setAttribute('aria-hidden', 'true'); // decorative only
      document.body.append(el);
      // Next frame: add the "shown" class so the opacity transition runs.
      requestAnimationFrame(() => el?.classList.add(`${BACKDROP_CLASS}--shown`));
    }

    // Top edge = bottom of NDE's navigation (0 once it has scrolled out of view).
    const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
    const top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
    const topPx = `${top}px`;
    if (el.style.getPropertyValue('--ec-flag-top') !== topPx) {
      el.style.setProperty('--ec-flag-top', topPx);
    }

    // Only touch the style when the flag actually changes (no observer churn:
    // attribute changes are not observed anyway, this just avoids repaints).
    if (el.dataset['image'] !== scope.image) {
      el.dataset['image'] = scope.image;
      // JSON.stringify quotes and escapes the URL safely for CSS url("…").
      el.style.backgroundImage = `url(${JSON.stringify(scope.image)})`;
    }
  }
}

/** The backdrop CSS; tuning variables first. */
const BACKDROP_CSS = `
  .${BACKDROP_CLASS} {
    /* ---- tuning ------------------------------------------------------- */
    --ec-flag-opacity: .07;
    --ec-flag-blur: 2px;
    --ec-flag-tilt: 0deg;
    --ec-flag-lean: 0deg;
    --ec-flag-fade: 95%;
    /* ------------------------------------------------------------------ */

    /* Window-wide, from under the navigation (--ec-flag-top is set by the
       component) down to the bottom of the window. */
    position: fixed;
    left: 0;
    right: 0;
    top: var(--ec-flag-top, 0px);
    bottom: 0;
    pointer-events: none;
    /* The flag covers the whole area (cropped, never distorted). */
    background: no-repeat center top / cover;
    filter: blur(var(--ec-flag-blur)) saturate(.9);
    transform: perspective(1400px)
               rotateY(var(--ec-flag-tilt))
               rotateX(var(--ec-flag-lean));
    transform-origin: center top;
    /* Full strength at the top, fading out towards the bottom of the window. */
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent var(--ec-flag-fade));
            mask-image: linear-gradient(to bottom, #000 0%, transparent var(--ec-flag-fade));
    opacity: 0;
  }
  .${BACKDROP_CLASS}--shown { opacity: var(--ec-flag-opacity); }

  /* Under the content: below every non-positioned block of the page. */
  .${BACKDROP_CLASS}--behind { z-index: -1; }

  /* On top, tinting instead of covering: white × flag colour = faint tint,
     dark text stays dark. */
  .${BACKDROP_CLASS}--over {
    z-index: 2147483000;
    mix-blend-mode: multiply;
  }

  @media (prefers-reduced-motion: no-preference) {
    .${BACKDROP_CLASS} { transition: opacity .6s ease; }
  }
  @media print {
    .${BACKDROP_CLASS} { display: none !important; }
  }
`;

/** Add the backdrop CSS to <head> once per page. */
function injectStylesOnce(): void {
  if (document.getElementById('ec-scope-backdrop-style')) return;
  const style = document.createElement('style');
  style.id = 'ec-scope-backdrop-style';
  style.textContent = BACKDROP_CSS;
  document.head.append(style);
}
