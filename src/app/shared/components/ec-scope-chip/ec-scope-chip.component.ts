// src/app/shared/components/ec-scope-chip/ec-scope-chip.component.ts
//
// Visual cue for the "subject scope" (SubjectScopeService): while a scope is
// active on the results page, NDE's search box shows
//
//     [ 🇧🇪 Belgium × | <empty input>              ✕ | 🔍 ]
//
// and the input is emptied of the seed query ("Belgium") the tile searched for,
// so the user simply types their topic. The × on the chip ends the scope and
// reloads the results without the country facet.
//
// HOW IT ATTACHES (verified NDE markup, Oct 2026, results page):
//   nde-search-bar-presenter
//     div.search-bar-container[role=search]
//       …
//       div.search_box_container            ← chip is inserted here,
//         input#main-search-bar             ← right before the input
//         div.search-bar-actions (clear ✕, search 🔍)
// The chip is plain DOM created here, not part of an Angular template, because
// the box belongs to NDE. NDE may re-render the box at any time, so we re-check
// after every navigation and every DOM change (batched to one check per frame)
// and simply re-insert the chip when it is missing.
//
// AFTER THE SCOPE ENDS (e.g. "Home" in the top menu)
// NDE keeps the last query in its search box, so the home page would show
// "Belgium". When the box still holds exactly the ended scope's seed query
// (SubjectScopeService.endedSeedQuery) and nobody is typing in it, it is cleared
// for real — value emptied AND an `input` event, so NDE's form control is empty
// too. Material's autocomplete only opens its panel on input events while the
// field has focus, and we only do this when it hasn't, so no panel pops up.
// As soon as the box holds anything else, the memory is dropped.
//
// WHY THE INPUT IS CLEARED WITHOUT AN `input` EVENT (results page)
// Only the visible value is blanked. Firing `input` would also update NDE's form
// control, but it opens the autocomplete panel. Leaving the control alone is
// harmless: typing replaces it, and submitting the blank-looking field simply
// re-runs the seed query within the same country.
//
// STYLES live in this file (injected once as <style id="ec-scope-chip-style">)
// because the chip sits outside every Angular component's style scope.
//
// HIDING THE SCOPED SUBJECT IN THE FILTERS
// While "Belgium" is the scope, offering "Belgium" again as a Subject filter is
// noise (it matches every result). A second <style id="ec-scope-facet-hide">
// holds one CSS rule for the current scope and is emptied when there is none.
// Pure CSS, so it keeps working when NDE re-renders the filter panel.
// Verified NDE markup (Oct 2026), filter side panel:
//   nde-filters-group#topic … div > nde-filters-value
//     … button.facet-name[data-qa="topic.North Macedonia"]
// data-qa carries the facet value, but its casing is not stable: the same
// subject has appeared both as "topic.Bosnia and Herzegovina" and as
// "topic.Bosnia And Herzegovina". The selector therefore matches
// case-insensitively (CSS attribute flag `i`).
//
// MOUNT POINT: EcSharedRootComponent (slot `nde-search-bar-container-after`).
import { Component, NgZone, OnDestroy, inject } from '@angular/core';
import { EventType } from '@angular/router';
import { Subscription } from 'rxjs';
import { SHELL_ROUTER } from '../../../injection-tokens';
import { FACET_PARAM, SubjectScope, SubjectScopeService, isScopeFacet } from '../../subject-scope.service';

/** NDE selectors this component depends on — update here if NDE changes its markup. */
const SEL = {
  box: 'nde-search-bar-presenter .search_box_container',
  input: '#main-search-bar',
  /** One filter group in NDE's side panel; `#<field>` is the facet field, e.g. #topic. */
  filterGroup: 'nde-filters-group',
} as const;

/** id of the <style> element holding the "hide the scoped subject" rule. */
const FACET_HIDE_STYLE_ID = 'ec-scope-facet-hide';

/** Class of the chip element (also used to find an existing one). */
const CHIP_CLASS = 'ec-scope-chip';

@Component({
  selector: 'custom-ec-scope-chip',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-scope-chip' },
  template: '', // headless — the chip is inserted into NDE's search box
})
export class EcScopeChipComponent implements OnDestroy {
  private readonly scope = inject(SubjectScopeService);
  private readonly router = inject(SHELL_ROUTER);
  private readonly zone = inject(NgZone);

  private observer?: MutationObserver;
  private routerSub?: Subscription;
  /** True while a sync() is queued for the next animation frame. */
  private queued = false;

  constructor() {
    injectStylesOnce();

    // Everything below runs outside Angular's zone: it only touches NDE's DOM,
    // so there is no reason to trigger change detection on every mutation.
    this.zone.runOutsideAngular(() => {
      // Re-check whenever the DOM changes (NDE re-rendering the search box)…
      this.observer = new MutationObserver(() => this.queueSync());
      this.observer.observe(document.body, { childList: true, subtree: true });

      // …and after every navigation. NDE fills the input from the URL a moment
      // after the route changes, so check again shortly afterwards as well.
      this.routerSub = this.router.events.subscribe((e) => {
        if ((e as { type?: number }).type !== EventType.NavigationEnd) return;
        this.queueSync();
        setTimeout(() => this.queueSync(), 300);
      });
    });

    this.queueSync();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routerSub?.unsubscribe();
    removeChip();
    setFacetHideRule(null);
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

  /** Make the search box match the current scope: chip + placeholder + emptied seed query. */
  private sync(): void {
    const box = document.querySelector<HTMLElement>(SEL.box);
    const input = box?.querySelector<HTMLInputElement>(SEL.input) ?? null;
    const scope = this.activeScope();

    // Independent of the search box: hide (or un-hide) the scoped subject in
    // the filter panel.
    setFacetHideRule(scope);

    // No scope (or not on a scoped results page, or NDE markup not there yet):
    // make sure nothing of ours is left behind.
    if (!box || !input || !scope) {
      removeChip();
      if (input) {
        restorePlaceholder(input);
        this.clearEndedSeed(input);
      }
      return;
    }

    // Insert (or replace) the chip right before the input.
    const existing = document.querySelector<HTMLElement>(`.${CHIP_CLASS}`);
    const upToDate =
      !!existing &&
      existing.parentElement === box &&
      existing.nextElementSibling === input &&
      existing.dataset['facet'] === scope.facet;
    if (!upToDate) {
      existing?.remove();
      box.insertBefore(this.buildChip(scope), input);
    }

    // Placeholder hints at the scope; the original is kept to restore later.
    if (input.dataset['ecPlaceholder'] === undefined) {
      input.dataset['ecPlaceholder'] = input.placeholder;
    }
    input.placeholder = `Search within ${scope.label}…`;

    // Empty the seed query ("Belgium"), but never while the user is typing.
    if (scope.seedQuery && input.value === scope.seedQuery && document.activeElement !== input) {
      input.value = '';
    }
  }

  /**
   * Scope ended and we're on the home page: if the box still shows the ended
   * scope's seed query ("Belgium"), empty it — including NDE's form value.
   */
  private clearEndedSeed(input: HTMLInputElement): void {
    const seed = this.scope.endedSeedQuery;
    if (seed === undefined) return;
    // Only on the home page. Elsewhere "Belgium" in the box can be legitimate:
    // after the chip's × the results page really shows a search for "Belgium".
    if (!window.location.pathname.endsWith('/home')) return;

    if (input.value === seed) {
      if (document.activeElement === input) return; // user is in the field: leave it
      input.value = '';
      // Bubbling `input` event → Angular's form control picks up the empty value.
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.value !== '') {
      // Something else is in the box now (the user's own query): stop watching.
      this.scope.endedSeedQuery = undefined;
    }
  }

  /** The scope, but only when we're on the results page AND its facet is applied. */
  private activeScope(): SubjectScope | null {
    return this.scope.activeOnResults();
  }

  /** Build the chip: [flag] Label [×]. */
  private buildChip(scope: SubjectScope): HTMLElement {
    const chip = document.createElement('span');
    chip.className = CHIP_CLASS;
    chip.dataset['facet'] = scope.facet;

    // Screen readers hear "Searching within Belgium"; sighted users see the flag + name.
    const sr = document.createElement('span');
    sr.className = 'ec-scope-chip__sr';
    sr.textContent = 'Searching within ';
    chip.append(sr);

    if (scope.image) {
      const img = document.createElement('img');
      img.src = scope.image;
      img.alt = ''; // decorative, the label says it all
      img.className = 'ec-scope-chip__flag';
      chip.append(img);
    }

    const label = document.createElement('span');
    label.className = 'ec-scope-chip__label';
    label.textContent = scope.label;
    chip.append(label);

    const remove = document.createElement('button');
    remove.type = 'button'; // never submit NDE's search form
    remove.className = 'ec-scope-chip__remove';
    remove.setAttribute('aria-label', `Stop searching within ${scope.label}`);
    remove.title = `Stop searching within ${scope.label}`;
    remove.textContent = '×';
    remove.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // keep NDE's search-box handlers out of it
      this.removeScope(scope);
    });
    chip.append(remove);

    return chip;
  }

  /** End the scope and show the same search without the country facet. */
  private removeScope(scope: SubjectScope): void {
    this.scope.clear(); // first, so SubjectScopeService doesn't re-add the facet
    removeChip();

    const params = new URLSearchParams(window.location.search);
    const kept = params.getAll(FACET_PARAM).filter((f) => !isScopeFacet(f, scope.facet));
    params.delete(FACET_PARAM);
    kept.forEach((f) => params.append(FACET_PARAM, f));
    params.delete('offset'); // back to the first page of the wider result set

    // Navigate inside Angular's zone so the shell updates normally.
    this.zone.run(() => this.router.navigateByUrl(`/search?${params.toString()}`));
  }
}

/**
 * Write (or clear) the CSS rule that hides the scope's own value in its filter
 * group, e.g. the "North Macedonia" checkbox under Subject while scoped to it.
 * The wrapper div of the matching nde-filters-value is hidden, so no gap is left.
 */
function setFacetHideRule(scope: SubjectScope | null): void {
  let style = document.getElementById(FACET_HIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = FACET_HIDE_STYLE_ID;
    document.head.append(style);
  }

  let css = '';
  if (scope) {
    // "topic,include,North Macedonia" → field "topic", value "North Macedonia".
    // The value may itself contain commas, so only the first two are separators.
    const [field, , ...rest] = scope.facet.split(',');
    const value = rest.join(',');
    if (field && value) {
      // CSS.escape keeps quotes, ü, ô etc. safe inside the selector.
      const group = `${SEL.filterGroup}#${CSS.escape(field)}`;
      const qa = CSS.escape(`${field}.${value}`);
      // ` i` = case-insensitive attribute match (see header: NDE re-cases values).
      css = `${group} div:has(> nde-filters-value button[data-qa="${qa}" i]) { display: none !important; }`;
    }
  }
  // Only touch the DOM when the rule actually changes (avoids observer churn).
  if (style.textContent !== css) style.textContent = css;
}

/** Remove our chip, if present. */
function removeChip(): void {
  document.querySelector(`.${CHIP_CLASS}`)?.remove();
}

/** Put NDE's own placeholder back. */
function restorePlaceholder(input: HTMLInputElement): void {
  const original = input.dataset['ecPlaceholder'];
  if (original === undefined) return;
  input.placeholder = original;
  delete input.dataset['ecPlaceholder'];
}

/** Add the chip CSS to <head> once per page. */
function injectStylesOnce(): void {
  if (document.getElementById('ec-scope-chip-style')) return;
  const style = document.createElement('style');
  style.id = 'ec-scope-chip-style';
  style.textContent = `
    /* Only while a chip is present: line the chip and the input up in one row.
       :has() keeps NDE's own layout untouched the rest of the time. */
    .search_box_container:has(> .${CHIP_CLASS}) {
      display: flex;
      align-items: center;
    }
    .search_box_container:has(> .${CHIP_CLASS}) > #main-search-bar {
      flex: 1 1 auto;
      min-width: 0;
    }

    /* The chip: a soft pill inside NDE's rounded search field. */
    .${CHIP_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      flex: 0 0 auto;
      max-width: 45%;
      margin: 0 .25rem 0 .75rem;
      padding: .2rem .25rem .2rem .5rem;
      border: 1px solid var(--sys-outline-variant, #c9ced6);
      border-radius: 999px;
      background: var(--sys-surface-container, #eef3fa);
      color: var(--sys-on-surface, #1d2433);
      font-size: .875rem;
      line-height: 1.4;
      white-space: nowrap;
    }
    /* Björn's hand-tuned offset: pulls the chip left to sit flush with NDE's
       rounded field edge. Keep this rule in future versions of this file. */
    .${CHIP_CLASS} {
      position: relative;
      left: -29px;
    }
    .${CHIP_CLASS}__flag {
      height: 1rem;
      width: auto;
      max-width: 1.75rem;
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(29, 36, 51, .18); /* keeps white flags visible */
    }
    .${CHIP_CLASS}__label {
      overflow: hidden;
      text-overflow: ellipsis; /* "Democratic Republic of the Congo" on narrow screens */
    }
    .${CHIP_CLASS}__remove {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
    }
    .${CHIP_CLASS}__remove:hover { background: rgba(0, 0, 0, .08); }
    .${CHIP_CLASS}__remove:focus-visible {
      outline: 2px solid var(--sys-primary, #004494);
      outline-offset: 1px;
    }
    /* Visually hidden, still read by screen readers. */
    .${CHIP_CLASS}__sr {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;
  document.head.append(style);
}
