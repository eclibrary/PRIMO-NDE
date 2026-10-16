// src/app/shared/ec-config.ts
//
// Configuration entry point for the EC custom module.
//
// WHERE VALUES LIVE: NOT here. Every setting (URLs, widget ids, labels, field
// mappings, per-view tweaks) is data in config/global.json and
// config/views/<view>.json, described by config/schema.json. prebuild.js merges
// global + view and writes src/app/shared/ec-config.generated.ts, which this
// file re-exports as EC_CONFIG. Edit the JSON (or run `npm run settings`) and
// rebuild; never edit the generated file.
//
// WHAT STAYS HERE: the TypeScript shape of the settings (EcConfigValues — keep
// it in sync with schema.json), the code-shaped bits that cannot be data
// (mapResponse), and small helpers (currentLang, localised, isSandbox, …).
//
// PER-VIEW VALUES: because each view is a separate build, EC_CONFIG already
// contains the merged values for the view being built. Components therefore
// read e.g. EC_CONFIG.askALibrarian.hideFields directly — there is no runtime
// "which view am I" lookup for settings.
import { EC_CONFIG_VALUES, EC_CONFIG_VIEW, EC_LANGUAGES } from './ec-config.generated';

/**
 * A UI language code ("en", "fr", "de", …). The list is DATA, not code: it
 * lives in config/languages.json (settings UI → Languages tab, or
 * `npm run languages`) and reaches the bundle as EC_LANGUAGES in the generated
 * config. Hence a plain string here — currentLang() only ever returns a code
 * from that list.
 */
export type EcLang = string;

/** The configured UI languages, English first (re-exported for components). */
export { EC_LANGUAGES };

/** Lookup by language with an English fallback — used for every localised string/URL. */
export type Localised<T = string> = Partial<Record<EcLang, T>> & { en: T };

/** What we know about the signed-in patron. All optional: fill what the API gives. */
export interface EcUserInfo {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Alma primary identifier (the `userName` claim of the Primo JWT). */
  primaryId?: string;
  /** Organisational unit, e.g. "OP.A.4.003" (Alma address line 2). */
  unit?: string;
  /** Work city code, e.g. "BRU" / "LUX" (Alma address line 4). */
  city?: string;
}

/** One link of the landing-page account counts (settings accountCounts.loans/favorites/savedSearches). */
export interface EcAccountCountItem {
  /** "singular|plural", `{n}` = the number, e.g. "{n} loan|{n} loans". */
  label: Localised;
  /** NDE route the link opens (data-ec-nav), e.g. "account/loans"; vid + lang are carried over. */
  route: string;
}

/** One notice banner (settings noticeBanners.banners[]). */
export interface EcNoticeBanner {
  /** HTML per language; sanitised before it is shown (sanitize.ts). */
  text: Localised;
  /** Where it goes: above / under the menu, under the search area, fixed at the bottom. */
  position: 'top' | 'belowMenu' | 'belowSearch' | 'bottom';
  /** Colour preset; 'custom' uses `color`. */
  style: 'theme' | 'info' | 'warning' | 'success' | 'custom';
  /** "#rrggbb" or "" — background for style 'custom'. */
  color: string;
  /** "YYYY-MM-DD" or "" — first / last day (included) it is shown. */
  from: string;
  until: string;
  /** Show a × button; closing is remembered per browser. */
  dismissible: boolean;
}

/** One collection badge (settings libraryOnTheGo.badges[]). */
export interface EcCollectionBadge {
  /** Alma collection id; matched against $$D in PNX control.colldiscovery. */
  collectionId: string;
  label: Localised;
  /** "#rrggbb" or "" (= theme colour) — text and (i) icon colour. */
  color: string;
  /** Accessible name of the (i) button. */
  infoButtonLabel: Localised;
  dialogTitle: Localised;
  /** Explanation as HTML; sanitised by Angular when rendered. Empty = no (i) button. */
  dialogHtml: Localised;
}

/** Day keys of openingHours.week, Monday first. */
export type EcWeekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** One exception to the weekly opening hours (holiday, closure, special hours). */
export interface EcOpeningHoursException {
  /** "YYYY-MM-DD". */
  from: string;
  /** "YYYY-MM-DD" or "" (= only `from`). */
  until: string;
  /** Same format as a weekday; "" = closed. */
  hours: string;
  note: Localised;
}

/**
 * Shape of the settings — the TypeScript twin of config/schema.json.
 * Every property here must exist in the schema and vice versa; the generated
 * file is typed against this, so a mismatch fails the build (that is the point).
 * Optional sections are features a view may not enable (e.g. network).
 */
export interface EcConfigValues {
  defaultLang: EcLang;
  userInfo: {
    jwtStorageKey: string;
    jwtNameClaim: string;
    endpoint: string;
  };
  lastSearch: {
    storageKeyPrefix: string;
    resultsPath: string;
    homePath: string;
    stripParams: string[];
    maxAgeDays: number;
    /** Page indication after the terms, `{n}` = page number; shown from page 2 on. */
    pageLabel: Localised;
    /** NDE's default results-per-page; used until another size is detected on screen. */
    defaultPageSize: number;
    /** Route of the full record page; a visit there records the "last viewed" record. */
    fullDisplayPath: string;
    /** Label put on the last viewed record in the results list. Empty en = off. */
    lastViewedLabel: Localised;
  };
  askALibrarian: {
    triggerUrlPrefixes: string[];
    formfillScriptUrl: string;
    libanswersHost: string;
    widgetId: Localised;
    prefillFromUser: Record<string, keyof EcUserInfo>;
    prefillStatic: Record<string, string>;
    context: {
      field: string;
      titleSelector: string;
      marker: Localised;
      labels: Localised<Record<'title' | 'mmsId' | 'recordId' | 'searchTerms' | 'link', string>>;
    };
    title: Localised;
    closeLabel: Localised;
    loadingLabel: Localised;
    errorLabel: Localised;
    resetOnClose: boolean;
    hideFields: string[];
    formCssPath: string;
  };
  libchat: {
    libanswersHost: string;
    hash: string;
    /** true = only signed-in patrons get the chat; guests never load it (see EcLibChatComponent). */
    signedInOnly?: boolean;
    floatButtonSelector: string;
    iframeSelector: string;
  };
  /**
   * Custom dialogs — see EcCustomDialogsComponent. Each dialog opens from its
   * `selector` ("Opens from"). Edited as a list in all three editors.
   * Until Oct 2026 the trigger was `name` (a plain word); older settings are
   * converted by migrateLegacySettings (runtime-settings.ts and its twins).
   */
  customDialogs: {
    dialogs: Array<{
      /**
       * "Opens from". A plain word (letters, digits, - and _), e.g.
       * "dialog-borrowing" = links to #dialog-borrowing + elements with that
       * class. Anything else = a CSS selector, e.g. 'a[href*="calendly.com"]'.
       */
      selector: string;
      title: Localised;
      /** HTML, sanitised by Angular when rendered. */
      html: Localised;
      /**
       * Embed code of a widget (divs + scripts), NOT sanitised: it is meant to
       * run. Inserted below the text on first open. "" = none.
       */
      widget?: string;
    }>;
    closeLabel: Localised;
  };
  /**
   * Opening hours — weekly hours + exceptions; fills [data-ec-opening-hours]
   * placeholders and opens a week pop-up from links to #ec-opening-hours.
   * See src/app/shared/opening-hours.ts.
   */
  openingHours: {
    enabled: boolean;
    /** "09:00-17:00" or "09:00-12:30, 13:30-17:00"; "" = closed. */
    week: Record<EcWeekday, string>;
    exceptions: EcOpeningHoursException[];
    /** `{hours}` = today's hours. */
    todayLabel: Localised;
    closedLabel: Localised;
    openNowLabel: Localised;
    closedNowLabel: Localised;
    /** Empty en = no link after today's hours. */
    weekLinkLabel: Localised;
    dialogTitle: Localised;
    exceptionsTitle: Localised;
    closeLabel: Localised;
    /** IANA zone, e.g. "Europe/Brussels"; "" = the visitor's clock. */
    timeZone: string;
  };
  /** Modal shown when the view is opened — see EcWelcomeMessageComponent. */
  welcomeMessage: {
    /** false = no message on this view (or on all views when set in global.json). */
    enabled: boolean;
    title: Localised;
    /** Message body as HTML markup; sanitised by Angular when rendered. Empty en = no message. */
    html: Localised;
    /** Days a "don't show again" tick is honoured (180 ≈ 6 months). */
    rememberDays: number;
    dontShowAgainLabel: Localised;
    closeLabel: Localised;
  };
  /**
   * Notice banners — coloured message bars, see src/app/shared/notice-banners.ts.
   * Plain DOM (no Angular component), started from bootstrap.ts, so they show
   * on every page.
   */
  noticeBanners: {
    enabled: boolean;
    banners: EcNoticeBanner[];
    /** Accessible name of the × button. */
    closeLabel: Localised;
    /** Accessible name of the region the banners sit in. */
    regionLabel: Localised;
  };
  /**
   * "Collection badges" (settings title): badges on records of Alma collections
   * — the EC's "Library on the Go" — see EcLibraryOnTheGoComponent. The key
   * keeps its original name for compatibility; until Oct 2026 the section held
   * ONE badge (collectionId, label, color, … directly in it). Such older
   * settings are converted to `badges[0]` when read (migrateLegacySettings in
   * runtime-settings.ts and its twins in the editors).
   */
  libraryOnTheGo: {
    enabled: boolean;
    badges: EcCollectionBadge[];
    closeLabel: Localised;
  };
  /**
   * "Free versions (Unpaywall)" link on records with a DOI — see
   * EcOpenAccessComponent. Off by default: every lookup is a request from the
   * visitor's browser to api.unpaywall.org (privacy notice!).
   */
  openAccess: {
    enabled: boolean;
    /** Contact address Unpaywall requires (?email=). Empty = no lookups. */
    email: string;
    /** true = skip records that already have online access (delivery.availability fulltext*). */
    onlyWithoutFullText: boolean;
    linkLabel: Localised;
    /** Added in brackets after linkLabel, per Unpaywall "version"; empty = nothing added. */
    publishedLabel: Localised;
    acceptedLabel: Localised;
    submittedLabel: Localised;
    /** title attribute of the link (tooltip + screen readers). */
    linkTitle: Localised;
  };
  /** "Loans due soon" line on the landing page — see EcLoansDueComponent. */
  loansDue: {
    enabled: boolean;
    /** A loan due within this many days counts as "due soon". */
    dueSoonDays: number;
    /** `{n}` = number of overdue loans. */
    overdueLabel: Localised;
    /** `{n}` = number of loans, `{days}` = dueSoonDays. */
    dueSoonLabel: Localised;
    /** TEST ONLY: read the loan history, so past loans show up as overdue. */
    testWithPastLoans: boolean;
    /** Placeholders {type}, {lang}, {inst}, {patronId}, {vid}. */
    endpoint: string;
  };
  /**
   * Loans / saved records / saved searches counts on the landing page, also
   * shown to guests from localStorage — see EcAccountCountsComponent.
   * Off in global.json; switched on per view (Find-eR only, Oct 2026).
   */
  accountCounts: {
    enabled: boolean;
    /** Screen-reader name of the row of links. */
    ariaLabel: Localised;
    /**
     * Line shown above the links whenever they are shown ("Welcome back").
     * Empty en = no line. A container with data-ec-account-counts-welcome="off"
     * never shows it (Find-eR: the signed-in block, which has it as heading).
     */
    welcomeLabel: Localised;
    /** One entry per item. label = "singular|plural" with {n}; route = NDE route, e.g. "account/loans". */
    loans: EcAccountCountItem;
    favorites: EcAccountCountItem;
    savedSearches: EcAccountCountItem;
    /** TEST ONLY: count the loan history instead of the active loans. */
    testWithPastLoans: boolean;
    /** localStorage key = prefix + vid. */
    storageKeyPrefix: string;
    /** Placeholders {type}, {lang}, {inst}, {patronId}, {vid}. */
    loansEndpoint: string;
    /** Placeholders {lang}, {vid}. */
    favoritesEndpoint: string;
    /** Placeholders {lang}, {inst}, {patronId}, {vid}. */
    savedSearchesEndpoint: string;
  };
  /** EC network check — see NetworkService. Optional: absent = off (treated as external). */
  network?: {
    enabled: boolean;
    /** A URL that only answers on the EC network. */
    pingUrl: string;
    /** Give up after this many ms and treat the visitor as external. */
    timeoutMs: number;
  };
  /** Reading room PCs — see kiosk.ts. Optional: absent = 60 minutes, English texts. */
  kiosk?: {
    /** Minutes without activity before the tab is reset; 0 = never. */
    idleMinutes: number;
    /** "Are you still there?" dialog, shown one minute before the reset. */
    warningTitle: Localised;
    /** `{s}` = seconds left. */
    warningText: Localised;
    continueLabel: Localised;
  };
  /**
   * "Print return label" link under loans in the library card — see
   * src/app/shared/components/ec-print-return-label. In global.json (off by
   * default) so every view can switch it on; the technical bits (label page
   * path, where the library code sits, how a returned loan is recognised) are
   * constants in the component, not settings — they never change per view.
   */
  printReturnLabel: {
    /** "Activate": false = the component renders nothing in this view. */
    enabled: boolean;
    /** true = also render the link on returned (history) loans; false = active loans only. */
    showOnPastLoans: boolean;
    label: Localised;
  };
}

/**
 * The settings for THIS build (global + view, merged at build time) plus the
 * code-shaped members that cannot live in JSON.
 */
export const EC_CONFIG = {
  ...EC_CONFIG_VALUES,
  userInfo: {
    ...EC_CONFIG_VALUES.userInfo,
    /**
     * Turn the personal_settings JSON into EcUserInfo. Every field there is an
     * object `{ value, maxlen, usage, … }`, hence the `val()` unwrapping.
     * `mailattachement.value` is the same address in a second place — used as
     * fallback if `email` is empty. Code, not data: the response shape is
     * Ex Libris' to change.
     */
    mapResponse(json: any): EcUserInfo {
      const d = json?.data ?? {};
      const val = (f: any): string | undefined =>
        (typeof f === 'string' ? f : f?.value)?.trim() || undefined;
      return {
        email: val(d.email) ?? val(d.mailattachement),
        // EC-specific use of the Alma address lines (see EcUserInfo).
        unit: val(d.address2),
        city: val(d.address4),
      };
    },
  },
};

/** Key of the view this bundle was built for ('' for a plain `ng build`). Informational. */
export const EC_BUILD_VIEW = EC_CONFIG_VIEW;

/**
 * Current UI language, from the `lang` query parameter NDE always carries
 * (`?vid=…&lang=fr`), falling back to <html lang> and then to the default.
 * Kept here (not in a service) so static-config consumers can call it too.
 */
export function currentLang(): EcLang {
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  const fromHtml = document.documentElement.lang;
  const candidate = (fromQuery || fromHtml || EC_CONFIG.defaultLang).slice(0, 2).toLowerCase();
  // Any configured language is accepted; anything else falls back to English.
  return EC_LANGUAGES.includes(candidate) ? candidate : 'en';
}

/** Current view id (`vid` query parameter), e.g. `32EUC_INST:VU2`. */
export function currentVid(): string {
  return new URLSearchParams(window.location.search).get('vid') ?? '';
}

/** Resolve a Localised map for the current language with English fallback. */
export function localised<T>(map: Localised<T>, lang: EcLang = currentLang()): T {
  return map[lang] ?? map.en;
}

/**
 * True on the Primo sandbox (premium sandbox hosts end in `-psb`), e.g.
 * https://ec-europa-finder-psb.primo.exlibrisgroup.com. Also true on the dev
 * proxy when it targets the sandbox, because the proxied page keeps its origin
 * only in the address bar — hence the check on the proxy target too.
 */
export function isSandbox(): boolean {
  return /-psb\.primo\.exlibrisgroup\.com$/.test(window.location.hostname)
    || /-psb\.primo\.exlibrisgroup\.com/.test(document.querySelector('script[src*="remoteEntry"]')?.getAttribute('src') ?? '');
}
