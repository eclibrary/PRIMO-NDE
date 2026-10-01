// src/app/shared/components/ec-scope-links/ec-scope-links.component.ts
//
// Compact "country resources" strip above result #1 while a country scope is
// active — the NDE replacement for VE's large msheader banner:
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ 🇧🇪 Belgium · country resources [🧭 Guide ↗] [📄 Country Report ↗] [📊 OECD ↗] │
//   └──────────────────────────────────────────────────────────────────────┘
//
// - Data: SCOPE_LINKS in scope-links.data.ts, keyed by the scope's `key`
//   (ISO code, taken from the tile's flag file name). No entry → no strip.
// - Shown only on the FIRST results page (no offset / offset=0), only while
//   the scope's facet is in the URL (SubjectScopeService.activeOnResults()).
//
// WHERE IT GOES (verified NDE markup, Oct 2026, results page):
//   div.search-result-list-content
//     nde-search-results-top-bar     ("1-10 of 70 Results", select all, export)
//     ← strip inserted here
//     nde-search-results             (div#searchResults → result items)
// It is inserted as a sibling BEFORE nde-search-results — never inside it — so
// NDE's own list rendering (ngFor over the results) is not disturbed.
//
// Like the chip, this is plain DOM (the container belongs to NDE): it is
// re-checked after every navigation and DOM change (batched per frame) and
// re-inserted, updated or removed as needed. Paging changes `offset` without a
// router event, but NDE re-renders the list, which triggers the DOM check.
//
// STYLES are injected once as <style id="ec-scope-links-style"> (same reason
// as the chip: the element is outside any Angular component's style scope).
//
// MOUNT POINT: EcSharedRootComponent (slot `nde-search-bar-container-after`).
import { Component, NgZone, OnDestroy, inject } from '@angular/core';
import { EventType } from '@angular/router';
import { Subscription } from 'rxjs';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { SubjectScope, SubjectScopeService } from '../../subject-scope.service';
import { SCOPE_LINKS, ScopeLink, ScopeLinkKind } from './scope-links.data';

/** NDE selectors this component depends on — update here if NDE changes its markup. */
const SEL = {
  /** The results list; the strip goes right before it. */
  results: '.search-result-list-content > nde-search-results',
} as const;

/** Class of the strip element (also used to find an existing one). */
const STRIP_CLASS = 'ec-scope-links';

/** Small inline icons (24×24, currentColor) — no external requests. */
const ICONS: Record<ScopeLinkKind, string> = {
  // Compass: outlined ring + diamond needle with a hollow centre. (Material's
  // filled "explore" path rendered as a solid disc here, hence hand-drawn.)
  guide:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" fill-rule="evenodd" d="M16.6 7.4 13.6 13.6 7.4 16.6 10.4 10.4Z M12 10.9a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2Z"/></svg>',
  // Document with text lines (Material "description") — DG ECFIN Country Report
  report:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 16h8v2H8v-2Zm0-4h8v2H8v-2Zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6Zm4 18H6V4h7v5h5v11Z"/></svg>',
  // Bar chart
  oecd:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 9.2h3V19H5V9.2ZM10.6 5h2.8v14h-2.8V5Zm5.6 8H19v6h-2.8v-6Z"/></svg>',
};

/** "Opens in a new tab" arrow shown after each link. */
const EXTERNAL_ICON =
  '<svg class="ec-scope-links__ext" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7Zm5 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"/></svg>';

@Component({
  selector: 'custom-ec-scope-links',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-scope-links' },
  template: '', // headless — the strip is inserted into NDE's results area
})
export class EcScopeLinksComponent implements OnDestroy {
  private readonly scope = inject(SubjectScopeService);
  private readonly router = inject(SHELL_ROUTER);
  private readonly zone = inject(NgZone);

  private observer?: MutationObserver;
  private routerSub?: Subscription;
  /** True while a sync() is queued for the next animation frame. */
  private queued = false;

  constructor() {
    injectStylesOnce();

    // Outside Angular's zone: we only touch NDE's DOM, no change detection needed.
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => this.queueSync());
      this.observer.observe(document.body, { childList: true, subtree: true });

      this.routerSub = this.router.events.subscribe((e) => {
        if ((e as { type?: number }).type === EventType.NavigationEnd) this.queueSync();
      });
    });

    this.queueSync();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routerSub?.unsubscribe();
    document.querySelector(`.${STRIP_CLASS}`)?.remove();
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

  /** Make the results area match the current scope: strip present, updated, or gone. */
  private sync(): void {
    const results = document.querySelector<HTMLElement>(SEL.results);
    const scope = this.scope.activeOnResults();
    const links = scope?.key ? SCOPE_LINKS[scope.key] ?? [] : [];
    const existing = document.querySelector<HTMLElement>(`.${STRIP_CLASS}`);

    // Nothing to show: no results list yet, no active scope, no links for this
    // country, or not on the first page.
    if (!results || !scope || links.length === 0 || !isFirstPage()) {
      existing?.remove();
      return;
    }

    // Already in the right place for the right country → nothing to do.
    if (existing && existing.nextElementSibling === results && existing.dataset['key'] === scope.key) {
      return;
    }

    existing?.remove();
    results.before(buildStrip(scope, links));
  }
}

/** True on page 1 of the results (offset missing or 0). */
function isFirstPage(): boolean {
  const offset = Number(new URLSearchParams(window.location.search).get('offset') ?? 0);
  return !offset; // NaN and 0 both count as "first page"
}

/**
 * Visible text of a link. The guide link names the country ("EC Library guide
 * on Belgium") so it reads on its own; other links use their label as is.
 * Done here rather than in scope-links.data.ts so the data keeps one plain
 * label per kind and the country name always matches the scope (chip, strip).
 */
function linkText(link: ScopeLink, scope: SubjectScope): string {
  return link.kind === 'guide' ? `${link.label} on ${scope.label}` : link.label;
}

/** Build the strip for one country. */
function buildStrip(scope: SubjectScope, links: readonly ScopeLink[]): HTMLElement {
  const strip = document.createElement('section');
  strip.className = STRIP_CLASS;
  strip.dataset['key'] = scope.key ?? '';
  strip.setAttribute('aria-label', `Resources about ${scope.label}`);

  // Left: flag + "Belgium · country resources"
  const title = document.createElement('div');
  title.className = `${STRIP_CLASS}__title`;
  if (scope.image) {
    const img = document.createElement('img');
    img.src = scope.image;
    img.alt = ''; // decorative; the name follows
    img.className = `${STRIP_CLASS}__flag`;
    title.append(img);
  }
  const name = document.createElement('span');
  name.className = `${STRIP_CLASS}__name`;
  name.textContent = scope.label;
  const sub = document.createElement('span');
  sub.className = `${STRIP_CLASS}__sub`;
  sub.textContent = 'country resources';
  title.append(name, sub);

  // Right: one pill link per entry, opening in a new tab.
  const list = document.createElement('ul');
  list.className = `${STRIP_CLASS}__list`;
  for (const link of links) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = `${STRIP_CLASS}__link`;
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer'; // the new tab gets no handle on NDE's window
    // Icon + label + external arrow; the label is the accessible name, with the
    // new-tab hint appended for screen readers.
    a.innerHTML = ICONS[link.kind] ?? '';
    const label = document.createElement('span');
    label.textContent = linkText(link, scope);
    const sr = document.createElement('span');
    sr.className = `${STRIP_CLASS}__sr`;
    sr.textContent = ' (opens in a new tab)';
    a.append(label, sr);
    a.insertAdjacentHTML('beforeend', EXTERNAL_ICON);
    li.append(a);
    list.append(li);
  }

  strip.append(title, list);
  return strip;
}

/** Add the strip CSS to <head> once per page. */
function injectStylesOnce(): void {
  if (document.getElementById('ec-scope-links-style')) return;
  const style = document.createElement('style');
  style.id = 'ec-scope-links-style';
  style.textContent = `
    /* The strip: one compact row above result #1, wrapping on narrow screens. */
    .${STRIP_CLASS} {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: .5rem 1rem;
      margin: .75rem 0;
      padding: .625rem 1rem;
      border: 1px solid var(--sys-outline-variant, #d5dbe5);
      border-left: 4px solid var(--sys-primary, #004494);
      border-radius: 8px;
      background: var(--sys-surface-container-low, #f5f8fc);
      color: var(--sys-on-surface, #1d2433);
    }

    .${STRIP_CLASS}__title {
      display: flex;
      align-items: center;
      gap: .5rem;
      min-width: 0;
    }
    .${STRIP_CLASS}__flag {
      height: 1.25rem;
      width: auto;
      max-width: 2.25rem;
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(29, 36, 51, .18); /* keeps white flags visible */
    }
    .${STRIP_CLASS}__name { font-weight: 700; }
    .${STRIP_CLASS}__sub  { color: var(--sys-on-surface-variant, #5a6475); font-size: .875rem; }
    .${STRIP_CLASS}__sub::before { content: "· "; }

    .${STRIP_CLASS}__list {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .${STRIP_CLASS}__link {
      display: inline-flex;
      align-items: center;
      gap: .375rem;
      padding: .375rem .75rem;
      border: 1px solid var(--sys-primary, #004494);
      border-radius: 999px;
      background: #fff;
      color: var(--sys-primary, #004494);
      font-size: .875rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
    }
    .${STRIP_CLASS}__link:hover {
      background: var(--sys-primary, #004494);
      color: #fff;
    }
    .${STRIP_CLASS}__link:focus-visible {
      outline: 3px solid #ffd617; /* EC yellow, as on the landing page */
      outline-offset: 2px;
    }
    .${STRIP_CLASS}__link svg { width: 1.125rem; height: 1.125rem; flex: none; }
    .${STRIP_CLASS}__link .${STRIP_CLASS}__ext { width: .875rem; height: .875rem; opacity: .75; }

    /* Visually hidden, still read by screen readers. */
    .${STRIP_CLASS}__sr {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;
  document.head.append(style);
}
