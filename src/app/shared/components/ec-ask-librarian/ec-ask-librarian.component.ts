// src/app/shared/components/ec-ask-librarian/ec-ask-librarian.component.ts
//
// "ASK A LIBRARIAN" LINKS — settings askALibrarian. Any link whose address
// starts with one of `triggerUrlPrefixes` (in the home page, header, footer,
// NDE's own menu, our components …) is an Ask-a-librarian link. This component
//
//   1. PREFILLS THE LINKS THEMSELVES — always, in both modes. Their href gets
//      URL parameters, so the form opens filled in even when the patron
//      middle-clicks, copies the link or opens it in a new tab:
//        nameField    ← the patron's name     (prefillName;  from the session JWT)
//        emailField   ← the patron's e-mail   (prefillEmail; Primo personal details)
//        <field>      ← an Alma user detail or a parameter of the page's
//                       address (customPrefills: field ← from + source)
//        context.field← page context          (addContext: title, MMS ID,
//                                              search terms, link — buildContext)
//      Patron details only for signed-in patrons; a value that is empty is
//      left out. The ORIGINAL href is kept in data-ec-ask-href and every
//      rewrite starts from it, so values never pile up and a sign-out removes
//      the previous patron's name and e-mail from every link at once (shared
//      PCs). Rewritten on load, on every DOM change (batched per frame — NDE
//      redraws parts of the page, and the context changes per page) and on
//      every sign-in/out.
//      A parameter only helps if the target page reads it: LibAnswers form
//      pages prefill fields from URL parameters with the field's name.
//
//   2. WITH `useDialog` — a plain click opens our dialog instead, with the
//      form from `widgetCode` (the provider's embed code, run by insertEmbed()
//      in embed.ts), and fills the SAME field names inside the form
//      (fillForm). LibAnswers draws its form in a closed shadow root: the
//      roots are tracked from the start (trackShadowRoots, embed.ts) so the
//      fill and `customCss` can get in. LibAnswers' OLDER question form has no
//      shadow root and is written with document.write: insertEmbed() catches
//      that, and the fill and CSS then work on the container itself (light DOM).
//      Forms inside an <iframe> (other providers) cannot be filled from our
//      page — use the link mode for those.
//      Ctrl/Cmd/Shift/middle-click keep their meaning (new tab with the
//      prefilled link).
//
// FILLING (fillForm): for FILL_WINDOW_MS after opening, whenever the form
// changes (it renders late and redraws parts — e.g. dependent fields), every
// field we have a value for is set again if it lost it — using the native
// value setter + input/change events, so the form's own code notices. A field
// the patron has typed in is never touched again.
//
// Until Oct 2026 the form came from a LibAnswers widget id and an external
// prefill helper on Europa (libanswers.script.js) — not shippable to other
// libraries. Older settings are converted (migrateLegacySettings in
// runtime-settings.ts): widget id + host → widgetCode, prefillFromUser →
// prefillName / prefillEmail / customPrefills.
//
// LIFECYCLE: with resetOnClose (the default) the form is thrown away on close
// and the embed code runs again on the next open — no stale draft, no "thank
// you" screen after a submission.
//
// MOUNT POINT: rendered by EcSharedRootComponent / EcNoobRootComponent, i.e.
// on pages with a search bar (home, results, full record).
import { Component, ElementRef, NgZone, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import { EC_CONFIG, EcUserInfo, currentLang, localised } from '../../ec-config';
import { UserInfoService } from '../../user-info.service';
import { AuthStateService } from '../../auth-state.service';
import { insertEmbed, shadowRootsIn, trackShadowRoots } from '../../embed';

const CONFIG = EC_CONFIG.askALibrarian;

/** Attribute holding a trigger link's original href (before our parameters). */
const ORIGINAL_ATTR = 'data-ec-ask-href';
/** How long after opening the form is kept filled while it renders/redraws (ms). */
const FILL_WINDOW_MS = 20000;
/** Give the form this long to appear before the loading text gives way anyway (ms). */
const READY_TIMEOUT_MS = 10000;

@Component({
  selector: 'custom-ec-ask-librarian',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-ask-librarian' },
  templateUrl: './ec-ask-librarian.component.html',
  styleUrls: ['./ec-ask-librarian.component.scss'],
})
export class EcAskLibrarianComponent implements OnDestroy {
  @ViewChild('dialog') private dialogRef!: ElementRef<HTMLDialogElement>;
  /** Where the widget's embed code goes. */
  @ViewChild('widgetHost') private widgetHost!: ElementRef<HTMLElement>;

  private readonly userInfo = inject(UserInfoService);
  private readonly auth = inject(AuthStateService);
  private readonly zone = inject(NgZone);

  // Localised strings, refreshed on every open.
  readonly title = signal('');
  readonly closeLabel = signal('');
  readonly loadingLabel = signal('');
  readonly errorLabel = signal('');

  /** 'loading' until the form is there; 'error' when a widget script failed to load. */
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Fallback link shown in the error state — the (prefilled) link the patron clicked. */
  readonly fallbackHref = signal<string>('');

  /** Patron details for the prefill; null = guest or not (yet) known. */
  private user: EcUserInfo | null = null;
  /** True once the widget's embed code is in the dialog (reset by resetOnClose). */
  private widgetInserted = false;
  /** Stops the current fill run (observers + timer). */
  private stopFill: (() => void) | null = null;

  private observer?: MutationObserver;
  private queued = false;
  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);

  constructor() {
    if (!CONFIG || !(CONFIG.triggerUrlPrefixes ?? []).length) return; // feature not set up

    // Before any widget script can run: remember shadow roots (LibAnswers' are closed).
    if (CONFIG.useDialog && CONFIG.widgetCode?.trim()) trackShadowRoots();

    // Patron details: (re)loaded on every sign-in/out; the links follow.
    effect(() => {
      this.auth.isSignedIn(); // read → tracked
      this.user = null;
      this.rewriteLinks();    // drop the previous patron's details at once
      void this.userInfo.load().then((u) => { this.user = u; this.rewriteLinks(); });
    });

    // Links appear and change all the time (NDE renders late, redraws, and the
    // context differs per page): rewrite after DOM changes, once per frame.
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => {
        if (this.queued) return;
        this.queued = true;
        requestAnimationFrame(() => { this.queued = false; this.rewriteLinks(); });
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    });

    document.body.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    document.body.removeEventListener('click', this.onClick, true);
    this.stopFill?.();
  }

  // ------------------------------------------------------------ the links

  /** Is `href` (absolute or relative) an Ask-a-librarian link? */
  private isTrigger(href: string): boolean {
    let abs: string;
    try { abs = new URL(href, window.location.href).href; } catch { return false; }
    return (CONFIG.triggerUrlPrefixes ?? []).some((p) => p && abs.startsWith(p));
  }

  /**
   * Give every trigger link its prefill parameters, rebuilt from its original
   * href (see the header). Cheap when nothing changed: the href is only
   * written when it differs.
   */
  private rewriteLinks(): void {
    const values = this.values();
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      if (a.closest('.ec-ask')) return; // our own dialog (fallback link)
      const original = a.getAttribute(ORIGINAL_ATTR) ?? a.getAttribute('href') ?? '';
      if (!this.isTrigger(original)) return;
      if (!a.hasAttribute(ORIGINAL_ATTR)) a.setAttribute(ORIGINAL_ATTR, original);
      let url: URL;
      try { url = new URL(original, window.location.href); } catch { return; }
      for (const [field, value] of Object.entries(values)) url.searchParams.set(field, value);
      const next = url.toString();
      if (a.href !== next) a.setAttribute('href', next);
    });
  }

  /**
   * Field name → value, from the settings: name, e-mail, other patron details
   * (signed-in only, non-empty only) and the page context.
   */
  private values(): Record<string, string> {
    const out: Record<string, string> = {};
    const u = this.user;
    const put = (field: string | undefined, value: string | undefined) => {
      const f = (field ?? '').trim();
      // Not trimmed: the context starts with empty lines on purpose (room to
      // type above the marker). Patron details come trimmed from Primo already.
      if (f && value && value.trim()) out[f] = value;
    };
    if (u) {
      if (CONFIG.prefillName) put(CONFIG.nameField, u.displayName);
      if (CONFIG.prefillEmail) put(CONFIG.emailField, u.email);
    }
    // Other prefills: from the patron's Alma details (signed-in only; the
    // default for entries without `from`), or from a parameter of the page's
    // own address (anyone, e.g. query or docid).
    const page = new URLSearchParams(window.location.search);
    for (const p of Array.isArray(CONFIG.customPrefills) ? CONFIG.customPrefills : []) {
      if (!p) continue;
      if (p.from === 'url') put(p.field, page.getAll((p.source ?? '').trim()).join(' ; ') || undefined);
      else if (u) put(p.field, detail(u, p.source));
    }
    if (CONFIG.addContext) put(CONFIG.context?.field, this.buildContext());
    return out;
  }

  // ---------------------------------------------------------- the dialog

  /** A plain click on a trigger link opens the dialog (useDialog only). */
  private handleClick(ev: MouseEvent): void {
    if (!CONFIG.useDialog || !CONFIG.widgetCode?.trim()) return; // link mode: let the link work
    // Leave modifier/middle clicks alone: the user asked for a new tab/window.
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const anchor = (ev.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.closest('.ec-ask') || anchor.hasAttribute('data-ec-no-modal')) return;
    if (!this.isTrigger(anchor.getAttribute(ORIGINAL_ATTR) ?? anchor.href)) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.zone.run(() => void this.open(anchor));
  }

  private opener: HTMLElement | null = null;

  async open(opener: HTMLAnchorElement | null = null): Promise<void> {
    const lang = currentLang();
    this.opener = opener;
    this.fallbackHref.set(opener?.href ?? CONFIG.triggerUrlPrefixes[0] ?? '');
    this.title.set(localised(CONFIG.title, lang));
    this.closeLabel.set(localised(CONFIG.closeLabel, lang));
    this.loadingLabel.set(localised(CONFIG.loadingLabel, lang));
    this.errorLabel.set(localised(CONFIG.errorLabel, lang));
    this.state.set('loading');

    const dialog = this.dialogRef.nativeElement;
    if (!dialog.open) dialog.showModal(); // modal = backdrop + focus trap + Esc

    // Patron details before filling (usually known already from the links).
    if (!this.user && this.auth.isSignedIn()) this.user = await this.userInfo.load();

    const host = this.widgetHost.nativeElement;
    try {
      if (!this.widgetInserted) {
        this.widgetInserted = true;
        await insertEmbed(host, CONFIG.widgetCode);
      }
      await this.waitForForm(host);
      this.state.set('ready');
      this.fillForm(host, this.values());
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
    this.stopFill?.();
    if (CONFIG.resetOnClose) {
      // Throw the form away; the next open runs the embed code again.
      this.widgetHost.nativeElement.replaceChildren();
      this.widgetInserted = false;
    }
    this.state.set('idle');
    this.opener?.focus(); // return focus to the link that opened us (a11y)
    this.opener = null;
  }

  /** Close when the backdrop (the <dialog> itself, outside the panel) is clicked. */
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dialogRef.nativeElement) this.close();
  }

  // ------------------------------------------------------------- the form

  /**
   * Resolve when the widget shows something to fill or look at: a form field
   * (in the container or one of its shadow roots) or an iframe. After
   * READY_TIMEOUT_MS it resolves anyway — some widgets have no fields.
   */
  private waitForForm(host: HTMLElement): Promise<void> {
    const found = () => !!host.querySelector('input, textarea, select, iframe')
      || shadowRootsIn(host).some((r) => !!r.querySelector('input, textarea, select'));
    return new Promise((resolve) => {
      if (found()) return resolve();
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (found() || Date.now() - started > READY_TIMEOUT_MS) { window.clearInterval(timer); resolve(); }
      }, 150);
    });
  }

  /**
   * Fill the form with `values` (field name → value) and keep it filled for
   * FILL_WINDOW_MS while it renders and redraws; keep customCss in its shadow
   * roots until the dialog closes (onClosed → stopFill). See FILLING in the header.
   */
  private fillForm(host: HTMLElement, values: Record<string, string>): void {
    this.stopFill?.();
    const touched = new Set<string>();         // fields the patron typed in
    const watched = new Set<Node>();            // roots we observe already
    const observers: MutationObserver[] = [];
    /** Values are (re)set only during FILL_WINDOW_MS; the CSS is kept up while the dialog is open. */
    let filling = true;

    const markTouched = (ev: Event) => {
      const name = (ev.target as HTMLInputElement | null)?.name;
      if (ev.isTrusted && name) touched.add(name);
    };

    const apply = () => {
      const roots: Array<ParentNode & Node> = [host, ...shadowRootsIn(host)];
      for (const root of roots) {
        if (!watched.has(root)) {
          watched.add(root);
          root.addEventListener('input', markTouched, true);
          const mo = new MutationObserver(() => apply());
          mo.observe(root, { childList: true, subtree: true });
          observers.push(mo);
        }
        // Every pass, not once: a form that redraws itself (innerHTML) wipes our <style>.
        addCss(root);
        if (!filling) continue;
        for (const [name, value] of Object.entries(values)) {
          if (touched.has(name)) continue;
          root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${CSS.escape(name)}"]`)
            .forEach((field) => setValue(field, value));
        }
      }
    };

    const stop = () => {
      observers.forEach((o) => o.disconnect());
      watched.forEach((r) => r.removeEventListener('input', markTouched, true));
      window.clearTimeout(timer);
      if (this.stopFill === stop) this.stopFill = null;
    };
    const timer = window.setTimeout(() => { filling = false; }, FILL_WINDOW_MS);
    this.stopFill = stop;
    this.zone.runOutsideAngular(() => apply());
  }

  // -------------------------------------------------------------- context

  /**
   * The context block from the current page:
   *   - title: only on a full record (docid in the address), read from the
   *            page (context.titleSelector) — never on a results page
   *   - id:    the `docid` parameter; `alma…` ids are MMS IDs, others
   *            (e.g. `cdi_…`) are reported as record ids
   *   - search terms: every `query` parameter (NDE: `query=europe`; the
   *            VE-style `any,contains,europe` also occurs — terms part kept)
   *   - link:  the current page, minus dev-only parameters
   * Preceded by two empty lines and the marker, so the patron types above it.
   */
  private buildContext(): string {
    const cfg = CONFIG.context;
    if (!cfg) return '';
    const lang = currentLang();
    const labels = localised(cfg.labels, lang);
    const params = new URLSearchParams(window.location.search);
    const lines: string[] = [];

    // Title only on a full record (a docid in the address): on a results page
    // the title selector would match the FIRST result, which is not what the
    // patron is asking about.
    const docid = params.get('docid');
    const title = docid && cfg.titleSelector ? document.querySelector(cfg.titleSelector)?.textContent?.trim() : '';
    if (title) lines.push(`${labels.title}: ${title}`);

    if (docid) {
      const isAlma = docid.startsWith('alma');
      lines.push(`${isAlma ? labels.mmsId : labels.recordId}: ${isAlma ? docid.slice(4) : docid}`);
    }

    const terms = params.getAll('query')
      .map((q) => (q.includes(',') ? q.split(',').slice(2).join(',') : q).trim())
      .filter(Boolean);
    if (terms.length) lines.push(`${labels.searchTerms}: ${terms.join(' ; ')}`);

    const link = new URL(window.location.href);
    link.searchParams.delete('useLocalCustomPackage');
    lines.push(`${labels.link}: ${link.toString()}`);

    return `\n\n${localised(cfg.marker, lang)}\n${lines.join('\n')}`;
  }
}

// ---------------------------------------------------------------- helpers

/**
 * A patron detail by name: a known EcUserInfo key (displayName, email,
 * primaryId, unit, city, …) or any personal_settings field (u.fields).
 */
function detail(u: EcUserInfo, source: string | undefined): string | undefined {
  const key = (source ?? '').trim();
  if (!key) return undefined;
  const known = (u as unknown as Record<string, unknown>)[key];
  if (typeof known === 'string') return known;
  return u.fields?.[key];
}

/**
 * Set a form field the way typing would: through the element's NATIVE value
 * setter (frameworks wrap `value` and ignore direct writes) and then `input` +
 * `change` events, so the form's own code sees the new value. Only when the
 * value differs — the fill runs again on every redraw. Selects: only to an
 * existing option. Checkboxes/radios/files are left alone. Exported for tests only.
 */
export function setValue(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (field instanceof HTMLInputElement && ['checkbox', 'radio', 'file', 'hidden', 'submit', 'button'].includes(field.type)) {
    if (field.type !== 'hidden') return;
  }
  if (field.value === value) return;
  if (field instanceof HTMLSelectElement && !Array.from(field.options).some((o) => o.value === value)) return;
  const proto = Object.getPrototypeOf(field);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(field, value); else field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

/**
 * Put the customCss setting into `root`: each shadow root of the form (page
 * CSS cannot reach in there) and the widget container itself, for forms
 * without a shadow root. The latter is an ordinary <style> in the page, so it
 * applies to the whole page — hence the advice to start such selectors with
 * .ec-ask (the dialog). Skipped when the root still has it.
 */
function addCss(root: ParentNode & Node): void {
  const css = CONFIG.customCss?.trim();
  if (!css || root.querySelector('style[data-ec-custom-css]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-ec-custom-css', '');
  style.textContent = css;
  root.appendChild(style);
}
