// src/app/shared/components/ec-custom-dialogs/ec-custom-dialogs.component.ts
//
// CUSTOM DIALOGS — pop-up windows with the library's own text, opened by
// clicking an element in the home page, header or footer HTML.
//
// SETTINGS (customDialogs, edited as a list in all three editors):
//   dialogs[]   { selector ("Opens from"), title (per language), html (per
//                 language, WYSIWYG), widget }
//   closeLabel  text of the Close button (per language)
//
// TRIGGER — the dialog's `selector` ("Opens from"), read in one of two ways:
//   - a PLAIN WORD (letters, digits, - and _, starting with a letter — PLAIN_WORD),
//     e.g. "dialog-borrowing", is a shortcut for the two easy triggers in the
//     library's own HTML:
//       a LINK to "#<word>":   <a href="#dialog-borrowing">Borrowing rules</a>
//       the word as a CLASS:   <a href="#" class="dialog-borrowing">…</a>
//       (any element; the class can sit next to others: class="tile dialog-…")
//   - ANYTHING ELSE is a CSS selector, e.g. a[href*="calendly.com"] — for
//     elements the library cannot edit, such as NDE's own main-menu links. An
//     invalid selector is skipped with one console warning (validDialogs()).
//   So a plain word is never read as a tag name ("footer" = #footer / .footer).
//   Until Oct 2026 the plain-word trigger was a separate `name` setting; older
//   settings are converted (migrateLegacySettings in runtime-settings.ts).
// Several elements may open the same dialog (a tile and a footer link …).
// Ask a librarian (EcAskLibrarianComponent) is NOT one of these: it has its own
// trigger setting and prefills the form — don't point a selector at its links.
// Use a link or a button so keyboard users can reach it; the component adds a
// pointer cursor to every trigger class (links have one already).
//
// HOW: one click listener on the document, in the CAPTURE phase (before NDE's
// own handlers), so it also works for HTML NDE renders after us and for
// re-renders. A plain left click on a trigger is cancelled (no navigation to
// href="#") and opens the dialog; nothing else is touched.
//
// SAFETY: the text is bound with [innerHTML], so Angular's sanitiser removes
// scripts, event handlers and inline styles. Plain words are CSS.escape()d
// before they go into a selector.
//
// WIDGETS (`widget`, Oct 2026): the embed code of a third-party widget — a
// LibAnswers/Microsoft/Google form, a booking tool, a chat — exactly as the
// provider gives it (<div>s + <script>s). Deliberately NOT sanitised: it has
// to run. This is the one place where settings.js puts code into Primo; that
// is no new risk, because whoever can change settings.js can also upload the
// package itself (i.e. this module's JavaScript). The editors say "paste only
// code from providers you trust".
//   HOW: on the FIRST opening of a dialog, its embed code is turned into DOM
//   in a container of its own (mountWidget): ordinary elements are copied,
//   each <script> is re-created so the browser runs it (scripts inserted via
//   innerHTML never run), in document order, external ones one after the
//   other. The container is kept per dialog (WIDGETS) and moved into the
//   dialog on every opening, so the script loads once and the widget keeps
//   its state. Iframes inside it reload when moved — harmless for forms.
//   Widgets that use document.write (very old embed codes) cannot work here.
//
// MOUNT: child of EcSharedRootComponent (EC views) and EcNoobRootComponent
// (noob kit) — i.e. on every page with a search bar, which includes the home page.
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation, inject, signal } from '@angular/core';
import { EC_CONFIG, Localised, localised } from '../../ec-config';

/** "Opens from" values matching this are plain words (see TRIGGER above), not CSS. */
const PLAIN_WORD = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** A dialog from the settings, ready to use: its trigger worked out once. */
interface ReadyDialog {
  /** "Opens from" as typed (trimmed) — also the key of its widget. */
  key: string;
  /** The plain word, when it is one: links to "#<word>" open the dialog too. */
  word: string;
  /** CSS selector of the elements that open it (".word" for a plain word). */
  css: string;
  title: Localised;
  html: Localised;
  widget: string;
}

/**
 * True while a component instance has installed its listener. The NDE slot the
 * root hangs on can render more than once; one listener per page is enough.
 */
let listening = false;

/** Widget containers by dialog key ("Opens from"), built on first opening (see WIDGETS above). */
const WIDGETS = new Map<string, HTMLElement>();

@Component({
  selector: 'custom-ec-custom-dialogs',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-custom-dialogs' },
  templateUrl: './ec-custom-dialogs.component.html',
  styleUrls: ['./ec-custom-dialogs.component.scss'],
  // None: the dialog text arrives via [innerHTML], which emulated encapsulation
  // does not reach. Every rule in the stylesheet starts with .ec-custom-dialog.
  encapsulation: ViewEncapsulation.None,
})
export class EcCustomDialogsComponent implements OnInit, OnDestroy {
  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLDialogElement>;
  /** Where the open dialog's widget container is put (empty when it has none). */
  @ViewChild('widgetHost') private widgetHostRef?: ElementRef<HTMLElement>;
  private readonly zone = inject(NgZone);

  readonly title = signal('');
  /** Raw HTML from the settings; Angular sanitises it when binding to [innerHTML]. */
  readonly html = signal('');
  readonly closeLabel = signal('');

  /** Valid, unique dialogs from the settings (first one wins when two open from the same thing). */
  private readonly dialogs = validDialogs();
  /** Is this instance the one with the listener? (see `listening`) */
  private owner = false;

  private readonly onClick = (ev: MouseEvent) => {
    // Plain left clicks only: Ctrl/Cmd/Shift/middle-click keep their meaning.
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    const target = ev.target as Element | null;
    if (!target?.closest) return;
    // A link whose href is exactly "#<word>" (attribute, not the resolved URL).
    const href = target.closest('a[href^="#"]')?.getAttribute('href') ?? '';
    for (const d of this.dialogs) {
      if ((d.word && href === `#${d.word}`) || target.closest(d.css)) {
        ev.preventDefault();
        ev.stopPropagation(); // NDE must not also act on it (e.g. its own link handling)
        this.zone.run(() => this.open(d));
        return;
      }
    }
  };

  ngOnInit(): void {
    if (!this.dialogs.length || listening) return;
    listening = this.owner = true;
    document.addEventListener('click', this.onClick, true);
    addPointerCursor(this.dialogs);
  }

  ngOnDestroy(): void {
    if (!this.owner) return;
    document.removeEventListener('click', this.onClick, true);
    listening = this.owner = false;
  }

  private open(d: ReadyDialog): void {
    const dlg = this.dialogRef?.nativeElement;
    if (!dlg) return;
    this.title.set(localised(d.title));
    this.html.set(localised(d.html));
    this.closeLabel.set(localised(EC_CONFIG.customDialogs.closeLabel));
    // This dialog's widget (built once), or nothing — this also takes the
    // previous dialog's widget out (it stays in WIDGETS, detached).
    const host = this.widgetHostRef?.nativeElement;
    if (host) {
      const widget = d.widget ? mountWidget(d.key, d.widget) : null;
      host.replaceChildren(...(widget ? [widget] : []));
      host.hidden = !widget;
    }
    if (!dlg.open) dlg.showModal(); // top layer + backdrop + focus trap; Esc closes
  }

  close(): void {
    this.dialogRef?.nativeElement.close();
  }

  /** A click on the <dialog> itself (outside the panel) is a backdrop click. */
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dialogRef?.nativeElement) this.close();
  }
}

/**
 * The dialogs from the settings, triggers worked out once. Skipped, with one
 * console warning each: an empty "Opens from", an invalid CSS selector (it
 * would throw on every click), and a second dialog with the same "Opens from".
 */
function validDialogs(): ReadyDialog[] {
  const list = EC_CONFIG.customDialogs?.dialogs ?? [];
  const seen = new Set<string>();
  const ok: ReadyDialog[] = [];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const key = String(d.selector ?? '').trim();
    if (!key) { console.warn('[ec] custom dialogs: a dialog without "Opens from" — skipped'); continue; }
    if (seen.has(key)) { console.warn(`[ec] custom dialogs: two dialogs open from "${key}" — the second one is skipped`); continue; }
    seen.add(key);
    const word = PLAIN_WORD.test(key) ? key : '';
    const css = word ? `.${CSS.escape(word)}` : key;
    if (!word) {
      try { document.createDocumentFragment().querySelector(css); }
      catch { console.warn(`[ec] custom dialogs: "${key}" is not a valid CSS selector — dialog skipped`); continue; }
    }
    ok.push({ key, word, css, title: d.title, html: d.html, widget: String(d.widget ?? '').trim() });
  }
  return ok;
}

/** Triggers look clickable even when they are not links (e.g. a <div> tile). */
function addPointerCursor(dialogs: ReadyDialog[]): void {
  const id = 'ec-custom-dialogs-cursor';
  if (document.getElementById(id)) return;
  const selectors = dialogs.map((d) => d.css);
  const style = document.createElement('style');
  style.id = id;
  // :where() = no specificity, so the library's own cursor rules still win;
  // one rule per selector, so one odd selector cannot cancel the others.
  style.textContent = selectors.map((s) => `:where(${s}) { cursor: pointer; }`).join('\n');
  document.head.appendChild(style);
}

/**
 * The widget container of a dialog, built on its first opening: the embed code
 * as DOM, with every <script> re-created so that it runs (see WIDGETS above).
 * External scripts are chained (each waits for the previous one to load),
 * because embed codes often load a library first and then call it inline.
 * Exported for tests only.
 */
export function mountWidget(key: string, code: string): HTMLElement {
  const existing = WIDGETS.get(key);
  if (existing) return existing;

  const box = document.createElement('div');
  box.className = 'ec-custom-dialog__widget-content';
  const template = document.createElement('template');
  template.innerHTML = code; // inert: nothing in a <template> runs or loads

  // Copy everything; collect the scripts (in document order) to run afterwards.
  // Each script leaves a placeholder and later goes back to exactly that spot:
  // some widgets draw themselves right next to their own <script> tag.
  const scripts: Array<{ script: HTMLScriptElement; spot: Comment }> = [];
  box.append(document.importNode(template.content, true));
  box.querySelectorAll('script').forEach((old) => {
    const fresh = document.createElement('script');
    for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value);
    fresh.text = old.text;
    // Not async: keep the order of the embed code.
    if (fresh.src) fresh.async = false;
    const spot = document.createComment(' ec: widget script ');
    old.replaceWith(spot);
    scripts.push({ script: fresh, spot });
  });
  WIDGETS.set(key, box);

  // Run them once the container is in the page (widgets look for their <div>
  // by id): next frame, after open() has put the box into the dialog.
  requestAnimationFrame(() => {
    let chain = Promise.resolve();
    for (const { script: s, spot } of scripts) {
      chain = chain.then(() => new Promise<void>((done) => {
        if (s.src) {
          s.addEventListener('load', () => done(), { once: true });
          s.addEventListener('error', () => { console.warn(`[ec] custom dialogs: widget script of the dialog opening from "${key}" did not load: ${s.src}`); done(); }, { once: true });
        }
        spot.replaceWith(s); // inserted into the page → the browser runs it
        if (!s.src) done(); // inline scripts run on insertion
      }));
    }
  });
  return box;
}
