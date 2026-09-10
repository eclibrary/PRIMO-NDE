// src/app/shared/ec-config.ts
//
// Shared, non-secret configuration for the EC custom module. Everything that is
// a "value" rather than "code" — URLs, IDs, labels, field mappings — lives here
// so it can be changed in one place and, when the repo is shared with another
// institution, adapted without touching components.
//
// Per-view overrides: this file is shared by all four views. If a view needs a
// different value, add a fileReplacement for this file in that view's
// angular.json configuration (same mechanism as mappings.ts) rather than
// branching on vid inside components.

/** UI languages the views are served in. Add a code here when a new language is enabled in Alma. */
export type EcLang = 'en' | 'fr';

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

export const EC_CONFIG = {
  /** Language to fall back to when the current UI language is not in a Localised map. */
  defaultLang: 'en' as EcLang,

  // ---------------------------------------------------------------------------
  // Signed-in user details (used to prefill forms). See UserInfoService.
  // ---------------------------------------------------------------------------
  userInfo: {
    /**
     * sessionStorage key under which Primo keeps the session JWT. Primo VE used
     * `primoExploreJwt`; NDE reuses it. Sent as `Authorization: Bearer …` to the
     * private Primo REST endpoints, exactly as the NDE shell does.
     * VERIFY on Find-eR: DevTools > Application > Session Storage.
     */
    jwtStorageKey: 'primoExploreJwt',

    /**
     * JWT claim holding the user's display name. Primo VE / NDE put it in
     * `userName`. VERIFY once: decode sessionStorage.primoExploreJwt (jwt.io)
     * and check which claim shows your name rather than your login id.
     */
    jwtNameClaim: 'displayName',

    /**
     * Endpoint returning the patron's personal details for the current session.
     * `{vid}` and `{lang}` are substituted at call time.
     * VERIFY on Find-eR: open My Account > Personal details with DevTools >
     * Network open and copy the request the shell makes; adjust `mapResponse`
     * below to its response shape.
     */
    endpoint: `/primaws/rest/priv/myaccount/personal_settings?vid={vid}`,

    /**
     * Turn the personal_settings JSON into EcUserInfo. Every field there is an
     * object `{ value, maxlen, usage, … }`, hence the `val()` unwrapping.
     * `mailattachement.value` is the same address in a second place — used as
     * fallback if `email` is empty.
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

  // ---------------------------------------------------------------------------
  // "Pick up where you left off" — last results page, kept in localStorage.
  // See EcLastSearchComponent.
  // ---------------------------------------------------------------------------
  lastSearch: {
    /** localStorage key = prefix + vid, so each view remembers its own search. */
    storageKeyPrefix: 'ec:lastSearch:',
    /** Router path of the results page (relative to the /nde base). */
    resultsPath: '/search',
    /** Router path of the landing page, where the link is rendered. */
    homePath: '/home',
    /** Query params never worth persisting (dev switches, cache-busters). */
    stripParams: ['useLocalCustomPackage', '_customAssetCheck'],
    /** Forget a search older than this. */
    maxAgeDays: 30,
  },

  // ---------------------------------------------------------------------------
  // Ask a librarian modal (LibAnswers widget + Europa prefill helper)
  // ---------------------------------------------------------------------------
  askALibrarian: {
    /**
     * Any <a href> that starts with one of these prefixes opens the modal instead
     * of navigating. Prefix match, so language variants (/en/, /fr/) and query
     * strings are covered. Keep the real page as the href: it stays the fallback
     * for middle-click, "open in new tab", no-JS, and when the module is absent.
     */
    triggerUrlPrefixes: [
      'https://ec.europa.eu/libraries/pages/askalibrarian/',
    ],

    /**
     * The prefill helper hosted on Europa (libanswers.script.js). It MUST execute
     * before the LibAnswers widget script (it patches attachShadow to keep the
     * widget's shadow root reachable), so the modal loads it first and waits.
     * Its stylesheet (libanswers.style.css) is resolved relative to this URL by
     * the script itself.
     */
    formfillScriptUrl: 'https://ec.europa.eu/libraries/libanswers/libanswers.script.js',

    /** LibAnswers site; widget scripts are `${libanswersHost}/1.0/widgets/${id}`. */
    libanswersHost: 'https://ec-europa-eu.libanswers.com',

    /**
     * LibAnswers question-form widget ID per language. The widget renders into a
     * div whose id LibAnswers derives from the widget id: `s-la-widget-${id}`.
     * Use the same id for both languages if you only have one form.
     * Set `en` to '' to disable the modal entirely (links then behave normally).
     */
    widgetId: {
      en: '8158',
      fr: '8158',
    } as Localised,

    /**
     * Prefill mapping: LibAnswers form field `name` → EcUserInfo property.
     * Only signed-in users have info; guests get an empty form.
     * Field names are what the LibAnswers form uses (inspect the rendered form);
     * custom question fields look like `custom_198012`.
     */
    prefillFromUser: {
      pname: 'displayName',
      pemail: 'email',
    } as Record<string, keyof EcUserInfo>,

    /**
     * Static values always applied, e.g. a hidden "source" field telling the
     * librarians the question came from Find-eR rather than Europa.
     * (Hidden inputs are only filled if the helper's `fillHidden` allows it.)
     */
    prefillStatic: {
      // custom_XXXXXX: 'Find-eR',
    } as Record<string, string>,

    /**
     * Context block appended to the question so the librarian sees what the
     * patron was looking at. Rendered into the form field named `field`;
     * lines whose value is unknown on the current page are simply omitted.
     */
    context: {
      /** LibAnswers field (a textarea) that receives the block. */
      field: 'pdetails',
      /** Where NDE shows the record title on the full-display page. */
      titleSelector: 'nde-record-title h3',
      /** Written first; the patron types above it, we append below it. */
      marker: {
        en: '**TYPE ABOVE THIS LINE**',
        fr: '**ÉCRIVEZ AU-DESSUS DE CETTE LIGNE**',
      } as Localised,
      labels: {
        en: { title: 'Item title', mmsId: 'MMS ID', recordId: 'Record ID', searchTerms: 'Search terms', link: 'Link' },
        fr: { title: 'Titre', mmsId: 'MMS ID', recordId: 'ID de la notice', searchTerms: 'Termes de recherche', link: 'Lien' },
      } as Localised<Record<'title' | 'mmsId' | 'recordId' | 'searchTerms' | 'link', string>>,
    },

    /** Modal title. */
    title: {
      en: 'Ask a librarian',
      fr: 'Demander à un bibliothécaire',
    } as Localised,

    /** Accessible label for the close button. */
    closeLabel: {
      en: 'Close',
      fr: 'Fermer',
    } as Localised,

    /** Shown while the widget loads. */
    loadingLabel: {
      en: 'Loading the form…',
      fr: 'Chargement du formulaire…',
    } as Localised,

    /** Shown when the widget script could not be loaded (offline, CSP, LibAnswers down). */
    errorLabel: {
      en: 'The form could not be loaded. Please try again or open the page directly:',
      fr: 'Le formulaire n’a pas pu être chargé. Réessayez ou ouvrez la page directement :',
    } as Localised,

    /** Discard the form on close so every open starts empty (see resetWidget()). */
    resetOnClose: true,

    /**
     * Per-view tweaks, keyed by the view part of the vid (`32EUC_INST:VU2` → 'VU2').
     * hideFields: form field `name`s whose whole row is hidden inside the widget.
     * A hidden field is still submitted (empty) — if LibAnswers marks it required,
     * fill it via prefillStatic instead of hiding it.
     * Views not listed get no tweaks.
     */
    perView: {
      // VU2: { hideFields: ['custom5'] },
    } as Record<string, { hideFields?: string[] }>,

    /**
     * Optional stylesheet injected INTO the widget's shadow root once the form
     * has rendered (page CSS cannot reach into shadow trees). Resolved against
     * the customization package, so the per-view assets overlay applies:
     *   src/assets/ask-librarian/form.css            → all views (optional)
     *   src/views/<view>/assets/ask-librarian/form.css → that view only
     * A missing file (404) is silently ignored.
     */
    formCssPath: 'assets/ask-librarian/form.css',
  },
} as const;

/**
 * Current UI language, from the `lang` query parameter NDE always carries
 * (`?vid=…&lang=fr`), falling back to <html lang> and then to the default.
 * Kept here (not in a service) so static-config consumers can call it too.
 */
export function currentLang(): EcLang {
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  const fromHtml = document.documentElement.lang;
  const candidate = (fromQuery || fromHtml || EC_CONFIG.defaultLang).slice(0, 2).toLowerCase();
  return candidate === 'fr' ? 'fr' : 'en';
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
