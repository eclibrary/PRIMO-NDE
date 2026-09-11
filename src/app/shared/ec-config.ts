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
import { EC_CONFIG_VALUES, EC_CONFIG_VIEW } from './ec-config.generated';

/** UI languages the views are served in (EN, FR, DE). Add a code here, in currentLang() AND in schema.json when a new language is enabled in Alma. */
export type EcLang = 'en' | 'fr' | 'de';

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

/**
 * Shape of the settings — the TypeScript twin of config/schema.json.
 * Every property here must exist in the schema and vice versa; the generated
 * file is typed against this, so a mismatch fails the build (that is the point).
 * Optional sections are features a view may not enable (e.g. printReturnLabel).
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
    floatButtonSelector: string;
    iframeSelector: string;
  };
  resourceSharing: {
    forceFormat: '' | 'digital' | 'physical' | 'photocopy';
    hideFormatField: boolean;
    autoCheckAvailability: boolean;
    formatFieldSelector: string;
    checkAvailabilitySelector: string;
    formatValues: Record<'digital' | 'physical' | 'photocopy', { values: string[]; labels: string[]; position: number }>;
  };
  printReturnLabel?: {
    labelPagePath: string;
    codePaths: string[];
    returnedMarker: string;
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
  return candidate === 'fr' || candidate === 'de' ? candidate : 'en';
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
