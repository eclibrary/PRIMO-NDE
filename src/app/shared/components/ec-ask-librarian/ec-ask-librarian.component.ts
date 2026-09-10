// src/app/shared/components/ec-ask-librarian/ec-ask-librarian.component.ts
//
// "Ask a librarian" modal. Any link whose href starts with one of
// EC_CONFIG.askALibrarian.triggerUrlPrefixes — in the static homepage, header,
// footer, NDE's own menu links, or our components — opens this modal with the
// LibAnswers question form, prefilled with the signed-in patron's details.
//
// HOW THE FORM GETS THERE (same mechanism as the Europa page, no iframe):
//   1. Load the Europa prefill helper `libanswers.script.js` (once per page).
//      It exposes window.LibAnswersFormFill and patches
//      Element.prototype.attachShadow so the widget's shadow root stays
//      reachable — hence it MUST run before step 2.
//   2. Render `<div id="s-la-widget-<id>">` inside the modal and inject the
//      LibAnswers widget script `${host}/1.0/widgets/<id>`. The widget renders
//      the form into that div.
//   3. Resolve the patron via UserInfoService, then call
//      LibAnswersFormFill.fill({ name, email, … }) — the helper waits for the
//      form, pierces the shadow root, handles dependent fields and re-renders.
//
// LIFECYCLE: with EC_CONFIG.askALibrarian.resetOnClose (the default) the form
// is discarded on close and the widget script re-injected on the next open, so
// every open starts empty — no stale draft, no "thank you" screen after a
// submission. The helper script is kept: it is stateless between fills.
//
// WHY A NATIVE <dialog>: focus trap, Esc, backdrop and inert background for
// free; nothing added to the federated bundle; no clash with the shell's
// Material overlay container.
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { EC_CONFIG, EcUserInfo, currentLang, currentVid, localised } from '../../ec-config';
import { UserInfoService } from '../../user-info.service';

/**
 * Set by webpack/module federation to the URL remoteEntry.js was loaded from —
 * i.e. the customization package root (…/custom/<INST>-<VIEW>/). Same trick as
 * AssetsPublicPathDirective; it is what makes package-relative fetches work on
 * the Primo host, through the dev proxy, and with useLocalCustomPackage alike.
 */
declare const __webpack_public_path__: string;

/** Minimal typing of the Europa helper's public API (see libanswers.script.js). */
interface LibAnswersFormFillApi {
  fill(values: Record<string, string>, options?: Record<string, unknown>): Promise<unknown>;
  waitForForm(options?: Record<string, unknown>): Promise<Element | null>;
  configure(options: Record<string, unknown>): LibAnswersFormFillApi;
  cancel(): LibAnswersFormFillApi;
}
declare global {
  interface Window { LibAnswersFormFill?: LibAnswersFormFillApi; }
}

@Component({
  selector: 'custom-ec-ask-librarian',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-ask-librarian' },
  templateUrl: './ec-ask-librarian.component.html',
  styleUrls: ['./ec-ask-librarian.component.scss'],
})
export class EcAskLibrarianComponent implements OnDestroy {
  @ViewChild('dialog') private dialogRef!: ElementRef<HTMLDialogElement>;
  /** Where widget containers are appended (one per widget id / language). */
  @ViewChild('widgetHost') private widgetHost!: ElementRef<HTMLElement>;

  private readonly userInfo = inject(UserInfoService);

  // Localised strings, refreshed on every open (language can change between opens).
  readonly title = signal(localised(EC_CONFIG.askALibrarian.title));
  readonly closeLabel = signal(localised(EC_CONFIG.askALibrarian.closeLabel));
  readonly loadingLabel = signal(localised(EC_CONFIG.askALibrarian.loadingLabel));
  readonly errorLabel = signal(localised(EC_CONFIG.askALibrarian.errorLabel));

  /** 'loading' until the form is in the DOM; 'error' if a script failed to load. */
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Fallback link shown in the error state — the page the user originally clicked. */
  readonly fallbackHref = signal<string>('');

  /**
   * Widget id → its injected <script>. Kept so a reset can remove both the
   * container and the script, letting the next open re-run the loader
   * (a fresh <script> element re-executes; the file itself comes from cache).
   */
  private readonly widgetScripts = new Map<string, HTMLScriptElement>();
  /** Single promise for the helper script so concurrent opens share one load. */
  private helperLoaded: Promise<void> | null = null;
  /** Per-view form CSS, fetched once per page load; '' = none (404) — do not refetch. */
  private formCss: Promise<string> | null = null;

  /** Element that had focus before opening, so we can return it on close. */
  private opener: HTMLElement | null = null;
  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);

  constructor() {
    document.body.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    document.body.removeEventListener('click', this.onClick, true);
    window.LibAnswersFormFill?.cancel();
  }

  // ---------------------------------------------------------------- triggers

  /** Decide whether a click is on an "Ask a librarian" link; if so, open the modal. */
  private handleClick(ev: MouseEvent): void {
    // Leave modifier/middle clicks alone: the user asked for a new tab/window.
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    const anchor = (ev.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;

    // Never intercept links inside our own dialog (the fallback link in the
    // error state points at the very URL that triggers us), nor links opted out.
    if (anchor.closest('.ec-ask') || anchor.hasAttribute('data-ec-no-modal')) return;

    const href = anchor.href; // resolved absolute URL
    const isTrigger = EC_CONFIG.askALibrarian.triggerUrlPrefixes.some((p) => href.startsWith(p));
    if (!isTrigger) return;

    // No widget configured → behave like a normal link.
    if (!localised(EC_CONFIG.askALibrarian.widgetId)) return;

    ev.preventDefault();
    ev.stopPropagation();
    this.open(anchor);
  }

  // ------------------------------------------------------------- open/close

  async open(opener: HTMLElement | null = null): Promise<void> {
    const lang = currentLang();
    const cfg = EC_CONFIG.askALibrarian;
    const widgetId = localised(cfg.widgetId, lang);
    const containerSelector = `#s-la-widget-${widgetId}`;

    this.opener = opener;
    this.fallbackHref.set((opener as HTMLAnchorElement | null)?.href ?? cfg.triggerUrlPrefixes[0]);
    this.title.set(localised(cfg.title, lang));
    this.closeLabel.set(localised(cfg.closeLabel, lang));
    this.loadingLabel.set(localised(cfg.loadingLabel, lang));
    this.errorLabel.set(localised(cfg.errorLabel, lang));
    this.state.set('loading');

    const dialog = this.dialogRef.nativeElement;
    if (!dialog.open) dialog.showModal(); // modal = backdrop + focus trap + Esc

    try {
      // Make sure the container for the current language exists and is the
      // only visible one (a language switch between opens gets its own div).
      this.showWidgetContainer(widgetId);

      // Order matters: helper first (attachShadow patch), then the widget.
      await this.loadHelper(containerSelector);
      await this.loadWidget(widgetId);

      // Prefill in parallel with the widget rendering: fill() itself waits for
      // the form to appear, so we can hand it the values as soon as we have them.
      const values = this.buildPrefill(await this.userInfo.load());
      const helper = window.LibAnswersFormFill!;
      const ready = helper.waitForForm({ containerSelector, watch: false });
      if (Object.keys(values).length) helper.fill(values, { containerSelector });

      // Hide the status text once the form exists (or the helper gives up → error).
      const form = await ready;
      this.state.set(form ? 'ready' : 'error');

      // View-specific adjustments inside the shadow root. Runs after EVERY
      // render because resetOnClose rebuilds the form on each open.
      if (form) await this.applyViewTweaks(widgetId);
    } catch (err) {
      console.warn('[ec] ask-a-librarian: widget failed to load', err);
      this.state.set('error');
    }
  }

  close(): void {
    const dialog = this.dialogRef.nativeElement;
    if (dialog.open) dialog.close();
  }

  /** Native `close` event: fires for Esc, our button, and backdrop clicks alike. */
  onClosed(): void {
    window.LibAnswersFormFill?.cancel(); // stop any pending observers/timers
    if (EC_CONFIG.askALibrarian.resetOnClose) this.resetWidget();
    this.state.set('idle');
    this.opener?.focus();                  // return focus to the link that opened us (a11y)
    this.opener = null;
  }

  /** Close when the backdrop (the <dialog> itself, outside the panel) is clicked. */
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dialogRef.nativeElement) this.close();
  }

  /**
   * Throw the rendered form away so the next open starts clean: no leftover
   * draft, no "thank you" screen after a submission. Removing the widget
   * <script> elements too is what lets loadWidget() re-inject (and so re-run)
   * the loader next time. The helper script stays loaded.
   */
  private resetWidget(): void {
    this.widgetHost.nativeElement.replaceChildren();
    for (const script of this.widgetScripts.values()) script.remove();
    this.widgetScripts.clear();
  }

  // --------------------------------------------------------- script loading

  /**
   * Load the Europa prefill helper once. Attributes mirror the ones the script
   * reads from its own tag: `data-la-formfill` lets it find itself under
   * async/defer, `data-container` scopes it to our widget div, `data-auto=false`
   * stops it from trying to prefill from the Primo URL's `vid`/`lang` params.
   */
  private loadHelper(containerSelector: string): Promise<void> {
    if (window.LibAnswersFormFill) return Promise.resolve();
    if (!this.helperLoaded) {
      this.helperLoaded = this.injectScript(EC_CONFIG.askALibrarian.formfillScriptUrl, {
        'data-la-formfill': '1',
        'data-container': containerSelector,
        'data-auto': 'false',
      }).then(() => {
        if (!window.LibAnswersFormFill) throw new Error('LibAnswersFormFill not defined after load');
      });
    }
    return this.helperLoaded;
  }

  /**
   * Inject the LibAnswers widget script for `widgetId`; it renders into the
   * matching div. No-op while a script for that id is still on the page
   * (i.e. between opens when resetOnClose is off).
   */
  private loadWidget(widgetId: string): Promise<void> {
    if (this.widgetScripts.has(widgetId)) return Promise.resolve();
    const url = `${EC_CONFIG.askALibrarian.libanswersHost}/1.0/widgets/${widgetId}`;
    return this.injectScript(url, { async: 'true' }).then((script) => {
      this.widgetScripts.set(widgetId, script);
    });
  }

  /** Append a <script> to <body>, resolving with the element on load, rejecting on error. */
  private injectScript(src: string, attrs: Record<string, string>): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'async') s.async = v === 'true';
        else s.setAttribute(k, v);
      }
      s.onload = () => resolve(s);
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  // ------------------------------------------------------------ view tweaks

  /**
   * View-specific adjustments applied inside the widget's shadow root once the
   * form exists:
   *   1. hide the fields listed in EC_CONFIG.askALibrarian.perView[<view>]
   *   2. inject the per-view stylesheet (assets overlay) as a <style> element
   * Both must happen INSIDE the shadow tree — page CSS and page-level
   * selectors do not cross the shadow boundary.
   */
  private async applyViewTweaks(widgetId: string): Promise<void> {
    const cfg = EC_CONFIG.askALibrarian;
    const root = this.findShadowRoot(widgetId);
    if (!root) return;

    // 1. Hide fields: walk up from the input to the row that holds label + input.
    //    The wrapper class list is a best guess at LibAnswers' markup; extend it
    //    if a field's label survives (inspect the shadow tree to see the wrapper).
    const viewKey = currentVid().split(':')[1] ?? '';
    for (const name of cfg.perView[viewKey]?.hideFields ?? []) {
      const input = root.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
      const row = input?.closest<HTMLElement>('.s-la-askform-field, .form-group, fieldset') ?? input;
      if (row) row.hidden = true;
    }

    // 2. Stylesheet: once per render (the root is new after every reset).
    if (cfg.formCssPath && !root.querySelector('style[data-ec-form-css]')) {
      const css = await this.loadFormCss(cfg.formCssPath);
      if (css) {
        const style = document.createElement('style');
        style.dataset['ecFormCss'] = '1';
        style.textContent = css;
        root.appendChild(style);
      }
    }
  }

  /** The widget's shadow root: LibAnswers attaches it on a child of our container, not the container itself. */
  private findShadowRoot(widgetId: string): ShadowRoot | null {
    const container = this.widgetHost.nativeElement.querySelector(`#s-la-widget-${widgetId}`);
    if (!container) return null;
    for (const el of Array.from(container.querySelectorAll('*'))) {
      if (el.shadowRoot) return el.shadowRoot;
    }
    return null;
  }

  /**
   * Fetch the per-view form CSS from the customization package. Cached for the
   * page's lifetime, including the "no file" outcome, so a view without an
   * override costs exactly one 404 per page load.
   */
  private loadFormCss(path: string): Promise<string> {
    if (!this.formCss) {
      const base = (typeof __webpack_public_path__ === 'string' ? __webpack_public_path__ : '') || '';
      const url = (base && !base.endsWith('/') ? base + '/' : base) + path.replace(/^\/+/, '');
      this.formCss = fetch(url)
        .then((res) => (res.ok ? res.text() : ''))
        .catch(() => ''); // offline or blocked: keep the widget's default look
    }
    return this.formCss;
  }

  // ---------------------------------------------------------------- helpers

  /** Ensure `<div id="s-la-widget-<id>">` exists in the modal and is the only visible one. */
  private showWidgetContainer(widgetId: string): void {
    const host = this.widgetHost.nativeElement;
    const id = `s-la-widget-${widgetId}`;
    let div = host.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!div) {
      div = document.createElement('div');
      div.id = id;
      host.appendChild(div);
    }
    for (const child of Array.from(host.children) as HTMLElement[]) {
      child.hidden = child !== div;
    }
  }

    /**
   * Compose the context block from the current page:
   *   - title: read from the DOM on full-display pages (config.titleSelector)
   *   - id:    the `docid` query param; `alma…` ids are MMS IDs, others
   *            (e.g. `cdi_…`) are reported as generic record ids
   *   - search terms: every `query` param, which NDE formats as
   *            `<field>,<operator>,<terms>` — we keep only the terms part
   *   - link:  the current URL, minus dev-only params
   * Returns '' when nothing at all is known (should not happen: the link always is).
   */
  private buildContext(): string {
    const cfg = EC_CONFIG.askALibrarian.context;
    const lang = currentLang();
    const labels = localised(cfg.labels, lang);
    const params = new URLSearchParams(window.location.search);
    const lines: string[] = [];

    const title = document.querySelector(cfg.titleSelector)?.textContent?.trim();
    if (title) lines.push(`${labels.title}: ${title}`);

    const docid = params.get('docid');
    if (docid) {
      const isAlma = docid.startsWith('alma');
      lines.push(`${isAlma ? labels.mmsId : labels.recordId}: ${isAlma ? docid.slice(4) : docid}`);
    }

    const terms = params.getAll('query')
      // NDE writes `query=europe`; VE-style `query=any,contains,europe` also occurs.
      .map((q) => (q.includes(',') ? q.split(',').slice(2).join(',') : q).trim())
      .filter(Boolean);
    if (terms.length) lines.push(`${labels.searchTerms}: ${terms.join(' ; ')}`);

    const link = new URL(window.location.href);
    link.searchParams.delete('useLocalCustomPackage');
    lines.push(`${labels.link}: ${link.toString()}`);

    if (!lines.length) return '';
    // Two blank lines above the marker: room for the patron to type.
    return `\n\n${localised(cfg.marker, lang)}\n${lines.join('\n')}`;
  }

  /** Map patron info + static values onto LibAnswers field names per EC_CONFIG. */
  private buildPrefill(user: EcUserInfo | null): Record<string, string> {
    const cfg = EC_CONFIG.askALibrarian;
    const values: Record<string, string> = { ...cfg.prefillStatic };
    if (user) {
      for (const [field, prop] of Object.entries(cfg.prefillFromUser)) {
        const v = user[prop];
        if (v) values[field] = String(v);
      }
    }

    // Page context (record title, id, search terms, link) for the librarian.
    const context = this.buildContext();
    if (context) values[cfg.context.field] = context;

    return values;
  }
}
