// src/app/shared/components/ec-menu-links/ec-menu-links.component.ts
//
// NDE opens EVERY custom main-menu link in a new window (target="_blank",
// "opens in a new window" icon and aria-label) — including internal ones such
// as "Home" (/nde/home?vid=…). Rule implemented here, for all views:
//
//   href starts with http:// or https:// (or //host)  → leave as is (new window)
//   anything else (/nde/home?…, relative paths, …)     → same window
//
// HOW (two layers, so it holds even if NDE re-renders the menu):
//  1. CLICK — a capture-phase listener catches plain left-clicks on such links
//     and navigates in the same window: through NDE's own router for /nde/…
//     paths (no page reload), otherwise with a normal same-window navigation.
//     Ctrl/Cmd/Shift/middle-click are left alone, so "open in new tab" still
//     works when the user asks for it.
//  2. LOOK — the link is made to stop *claiming* it opens a new window:
//     target="_self", no rel, the "new window" icon hidden, and NDE's
//     aria-label ("Home, opens in a new window" — localised by NDE) removed so
//     the accessible name is simply the visible text. Re-applied after every DOM
//     change (batched per frame), because NDE may rebuild the menu.
//
// VERIFIED NDE MARKUP (Oct 2026, desktop header):
//   nav[aria-label="Main Menu Region"] > div[data-qa="main-menu_links"] > ul > li > a
//     a[target="_blank"] … mat-icon[data-mat-icon-name="Open-in-a-new-window"]
// Not yet verified: the mobile (hamburger) menu. If it uses another container,
// add its selector to SEL.menuLinks.
//
// MOUNT POINT: EcSharedRootComponent (slot `nde-search-bar-container-after`),
// i.e. active in every view.
import { Component, NgZone, OnDestroy, inject } from '@angular/core';
import { SHELL_ROUTER } from '../../../injection-tokens';

/** NDE selectors this component depends on — update here if NDE changes its markup. */
const SEL = {
  /** Links in NDE's main menu that NDE set to open in a new window. */
  menuLinks: '[data-qa="main-menu_links"] a[target="_blank"]',
  /** NDE's "opens in a new window" icon inside such a link. */
  newWindowIcon: 'mat-icon[data-mat-icon-name="Open-in-a-new-window"]',
} as const;

/** Marker so a link is only rewritten once (NDE re-renders create fresh links). */
const DONE_ATTR = 'data-ec-same-window';

/** True for links that must keep opening in a new window. */
function isExternal(rawHref: string): boolean {
  return /^(https?:)?\/\//i.test(rawHref.trim());
}

@Component({
  selector: 'custom-ec-menu-links',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-menu-links' },
  template: '', // headless
})
export class EcMenuLinksComponent implements OnDestroy {
  /** The NDE shell's Angular router (documented injection token). */
  private readonly router = inject(SHELL_ROUTER);
  private readonly zone = inject(NgZone);

  private observer?: MutationObserver;
  /** True while a fixLinks() is queued for the next animation frame. */
  private queued = false;

  /** Bound once so exactly this listener can be removed on destroy. */
  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);

  constructor() {
    // (1) Click handling, capture phase: runs before NDE's own handlers and
    //     before the browser acts on target="_blank".
    document.addEventListener('click', this.onClick, true);

    // (2) Cosmetic fix-up, outside Angular's zone (pure DOM work).
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => this.queueFix());
      this.observer.observe(document.body, { childList: true, subtree: true });
    });
    this.queueFix();
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onClick, true);
    this.observer?.disconnect();
  }

  /** Same-window navigation for internal menu links. */
  private handleClick(ev: MouseEvent): void {
    // Only plain left-clicks; modified clicks keep the browser's behaviour.
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

    // Match both untouched links (target=_blank) and ones we already rewrote.
    const anchor = (ev.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      `[data-qa="main-menu_links"] a[href]`,
    );
    if (!anchor) return;

    const raw = anchor.getAttribute('href') ?? '';
    if (!raw || isExternal(raw)) return; // external → let NDE open a new window

    ev.preventDefault();
    ev.stopPropagation();

    // NDE app paths: hand them to the shell router (relative to the /nde base),
    // so the page doesn't reload. Anything else: ordinary same-window navigation.
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith('/nde/')) {
      const routerUrl = url.pathname.slice('/nde'.length) + url.search + url.hash;
      this.zone.run(() => this.router.navigateByUrl(routerUrl));
    } else {
      window.location.assign(url.href);
    }
  }

  /** Coalesce bursts of DOM mutations into one fixLinks() per frame. */
  private queueFix(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.fixLinks();
    });
  }

  /** Make internal menu links look and announce like same-window links. */
  private fixLinks(): void {
    document.querySelectorAll<HTMLAnchorElement>(SEL.menuLinks).forEach((a) => {
      if (a.hasAttribute(DONE_ATTR)) return;
      const raw = a.getAttribute('href') ?? '';
      if (!raw || isExternal(raw)) return;

      a.setAttribute(DONE_ATTR, '');
      a.target = '_self';
      a.removeAttribute('rel');
      // NDE's label is "<text>, opens in a new window" (localised); without it
      // the accessible name is the visible link text, in any language.
      a.removeAttribute('aria-label');
      // Hide (not remove) NDE's icon: the node stays where Angular expects it.
      const icon = a.querySelector<HTMLElement>(SEL.newWindowIcon);
      if (icon) icon.style.display = 'none';
    });
  }
}
