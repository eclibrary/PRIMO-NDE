// src/app/shared/components/ec-welcome-message/ec-welcome-message.component.ts
//
// "Welcome message": a modal that pops up when a patron opens the view, with a
// message the library can edit (announcements, "this is the new interface",
// planned downtime, …).
//
// SETTINGS: EC_CONFIG.welcomeMessage (config/global.json = the SHARED message
// for all views; config/views/<view>.json overrides it for one view). Edit with
// `npm run settings` — the message body is HTML, one large textarea per language.
//   - Shared message      → fill it in on the Global tab.
//   - Local message       → "Override for this view" on title/html in the view tab.
//   - Switched off        → `enabled: false` (globally, or overridden for one view).
//                           An empty English body also means "no message".
//
// WHEN IT SHOWS — three rules, checked in shouldShow():
//   1. Enabled and there is a body for the current language (English fallback).
//   2. Not closed earlier in THIS browser tab (sessionStorage). NDE is a
//      single-page app and re-creates our components while the patron navigates;
//      without this the message would pop up again on every page.
//   3. Not dismissed with "Don't show this message again" (localStorage) less
//      than `rememberDays` (default 180 ≈ 6 months) ago.
//
// "A NEW MESSAGE IS ALWAYS SHOWN": both stores are keyed by a FINGERPRINT (a
// short hash) of the message content — title + body in every language. Edit a
// single character and the fingerprint changes, so everybody sees the message
// again, including patrons who ticked the box. There is deliberately NO id or
// version number to bump by hand: nothing to forget. Side effects worth knowing:
//   - fixing a typo re-shows the message (it IS a different message);
//   - views that inherit the shared message share its fingerprint, so
//     dismissing it in Find-eR also dismisses it in PUBS (same host = same
//     localStorage). A view with its own message has its own fingerprint.
//   - EC Data runs on another host, hence a separate localStorage: the patron
//     dismisses there once more.
//
// THE HTML BODY is rendered through Angular's [innerHTML], i.e. SANITISED:
// <script>, inline event handlers, `style=""` and `data-*` attributes are
// removed; structure, links, images and `class` survive. Style the content with
// classes (rules in the .scss next to this file, or the Material Symbols icon
// font already loaded by _shared-theme.scss). Links to the Ask-a-librarian
// page open the modal as everywhere else (matched on href, no data-* needed).
//
// WHY A NATIVE <dialog>: same reasons as EcAskLibrarianComponent — focus trap,
// Esc, backdrop and inert background for free, no clash with the shell's
// Material overlay container.
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
// NOTE: that root sits on a search-bar slot, so the message appears on the
// first page WITH a search bar (landing page, results). A patron who enters on
// an account or full-record page sees it as soon as they reach such a page.
import { AfterViewInit, Component, ElementRef, ViewChild, ViewEncapsulation, signal } from '@angular/core';
import { EC_CONFIG, EcLang, currentLang, localised } from '../../ec-config';
import { isKiosk } from '../../kiosk';

/**
 * localStorage key: `{ "<fingerprint>": <epoch ms of dismissal> }`.
 * A map (not a single value) so a shared and a per-view message on the same
 * host keep separate dismissals. Expired entries are pruned on every read.
 */
const DISMISSED_KEY = 'ec:welcomeMessage:dismissed';
/** sessionStorage key: `["<fingerprint>", …]` — messages closed in this tab. */
const CLOSED_KEY = 'ec:welcomeMessage:closed';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True while a dialog of this component is open on the page. The NDE slot our
 * root hangs on can render more than once; this keeps a second instance from
 * stacking a second modal on top of the first.
 */
let openOnPage = false;

@Component({
  selector: 'custom-ec-welcome-message',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-welcome-message' },
  templateUrl: './ec-welcome-message.component.html',
  styleUrls: ['./ec-welcome-message.component.scss'],
  // None: the message body arrives via [innerHTML], and Angular's emulated
  // encapsulation does not reach injected markup. Every rule in the stylesheet
  // is therefore prefixed with `.ec-welcome` by hand to keep it contained.
  encapsulation: ViewEncapsulation.None,
})
export class EcWelcomeMessageComponent implements AfterViewInit {
  @ViewChild('dialog') private dialogRef!: ElementRef<HTMLDialogElement>;
  /** The "Don't show this message again" checkbox; read once, when the dialog closes. */
  @ViewChild('dontShow') private dontShowRef!: ElementRef<HTMLInputElement>;

  // Localised strings, set right before opening (see open()).
  readonly title = signal('');
  /** Raw HTML from the settings; Angular sanitises it when binding to [innerHTML]. */
  readonly html = signal('');
  readonly closeLabel = signal('');
  readonly dontShowAgainLabel = signal('');
  /** Reading room PC (kiosk.ts): hide the "don't show again" box. */
  readonly kiosk = isKiosk();

  /** Fingerprint of the configured message — identical for every language (see header). */
  private readonly fingerprint = fingerprintOf(EC_CONFIG.welcomeMessage);

  ngAfterViewInit(): void {
    // The <dialog> exists only after the view is initialised, hence this hook.
    if (this.shouldShow()) this.open();
  }

  // ------------------------------------------------------------- decisions

  /** The three rules from the header comment. */
  private shouldShow(): boolean {
    const cfg = EC_CONFIG.welcomeMessage;
    if (!cfg.enabled || openOnPage) return false;
    // (1) Something to say? localised() falls back to English.
    if (!localised(cfg.html).trim()) return false;
    // (2) Already closed in this tab.
    if (readJson<string[]>(sessionStorage, CLOSED_KEY, []).includes(this.fingerprint)) return false;
    // (3) Dismissed "for good" and still within the remember period.
    return this.readDismissed()[this.fingerprint] === undefined;
  }

  /**
   * The dismissal map with expired entries removed (and the cleaned map written
   * back, so localStorage does not collect fingerprints of old messages forever).
   */
  private readDismissed(): Record<string, number> {
    // KIOSK (reading room PCs, see kiosk.ts): no "don't show again" — nothing read or stored.
    if (isKiosk()) return {};
    const maxAge = EC_CONFIG.welcomeMessage.rememberDays * DAY_MS;
    const stored = readJson<Record<string, number>>(localStorage, DISMISSED_KEY, {});
    const fresh: Record<string, number> = {};
    let pruned = false;
    for (const [print, at] of Object.entries(stored)) {
      if (typeof at === 'number' && Date.now() - at < maxAge) fresh[print] = at;
      else pruned = true;
    }
    if (pruned) writeJson(localStorage, DISMISSED_KEY, fresh);
    return fresh;
  }

  // ------------------------------------------------------------ open/close

  private open(): void {
    const cfg = EC_CONFIG.welcomeMessage;
    const lang: EcLang = currentLang();
    this.title.set(localised(cfg.title, lang));
    this.html.set(localised(cfg.html, lang));
    this.closeLabel.set(localised(cfg.closeLabel, lang));
    this.dontShowAgainLabel.set(localised(cfg.dontShowAgainLabel, lang));

    openOnPage = true;
    // showModal(): top layer + backdrop + focus trap; Esc fires `close` too.
    this.dialogRef.nativeElement.showModal();
  }

  /** Close button and backdrop click. Esc closes natively; all three end in onClosed(). */
  close(): void {
    this.dialogRef.nativeElement.close();
  }

  /** A click on the dialog element itself (not the panel inside) is a backdrop click. */
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dialogRef.nativeElement) this.close();
  }

  /**
   * Native `close` event — the single place where the dismissal is recorded,
   * whichever way the patron closed the dialog (button, backdrop, Esc).
   */
  onClosed(): void {
    openOnPage = false;

    // Always: do not show again in this tab.
    const closed = readJson<string[]>(sessionStorage, CLOSED_KEY, []);
    if (!closed.includes(this.fingerprint)) writeJson(sessionStorage, CLOSED_KEY, [...closed, this.fingerprint]);

    // Only when the box is ticked: remember for `rememberDays`.
    // (No box in kiosk mode — dontShowRef is then undefined.)
    if (!isKiosk() && this.dontShowRef?.nativeElement.checked) {
      writeJson(localStorage, DISMISSED_KEY, { ...this.readDismissed(), [this.fingerprint]: Date.now() });
    }
  }
}

// ---------------------------------------------------------------- helpers

/**
 * Fingerprint of the message: FNV-1a (32-bit) over title + body in all
 * languages, as 8 hex characters. Not cryptographic — it only has to change
 * when the text changes. Labels and `rememberDays` are deliberately left out:
 * rewording the checkbox is not a new message.
 */
function fingerprintOf(cfg: typeof EC_CONFIG.welcomeMessage): string {
  const text = JSON.stringify([cfg.title, cfg.html]);
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime, 32-bit multiply
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Read JSON from a Storage, returning `fallback` when the key is missing, the
 * content is not valid JSON, or storage is unavailable (private mode, blocked
 * by policy). The message must never break the page over a storage error.
 */
function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Write JSON to a Storage; failures (quota, blocked storage) are ignored — worst case the message shows again. */
function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore — see doc comment */
  }
}
