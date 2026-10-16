// src/app/shared/runtime-settings.ts
//
// RUNTIME SETTINGS — the package's assets/settings.js, applied when the page opens.
//
// WHY: colleagues who cannot build (no Node/npm/Git) must still be able to change
// texts, links and switches. Every package therefore carries its settings as a
// separate file, assets/settings.js, edited with the settings editor that ships in
// the same package (assets/editor/index.html → "Download settings.js"). They put
// the downloaded file in the package, zip, upload — no build.
//
// HOW IT FITS
//   - At BUILD time, scripts/config-generate.cjs writes settings.js with the view's
//     full values (config/global.json + config/views/<view>.json) — identical to
//     the values compiled into EC_CONFIG. Unchanged packages behave exactly as before.
//   - At RUN time (this file), bootstrapRemoteApp (src/bootstrap.ts) awaits
//     loadRuntimeSettings() BEFORE Angular starts, so every component sees the
//     final values. The values are MERGED INTO the existing EC_CONFIG objects
//     (not replacing them), because several components keep a reference to their
//     section (`const CONFIG = EC_CONFIG.loansDue`) from file load.
//
// SAFETY
//   - The file is fetched as TEXT and JSON-parsed — never executed. ONE
//     deliberate exception: the "Widget code" of a custom dialog
//     (customDialogs.dialogs[].widget) is embed code that runs when the dialog
//     first opens (ec-custom-dialogs.component.ts). No new risk: whoever can
//     change settings.js can upload the whole package, i.e. this module.
//   - Wrong view: a settings.js whose `vid` differs from the page's vid (copied
//     from another view by mistake) is ignored, with a console warning.
//   - Type guard: a value only replaces a built-in value of the SAME type
//     (string/number/boolean/array/object). A typo like "60" for 60 is ignored,
//     with a console warning naming the setting.
//   - Missing file, network error, broken JSON, slow answer (> TIMEOUT_MS): the
//     built-in values apply, with one console line. The page never waits longer.
//   - Unknown keys (from an older or newer package) are skipped silently enough
//     (one console line listing them), so a settings.js survives package updates.
import { EC_CONFIG, EC_LANGUAGES, currentVid } from './ec-config';

/** Package root at runtime (…/nde/custom/<INST>-<VIEW>/), set by module federation. */
declare const __webpack_public_path__: string;

/** Give up on settings.js after this long and use the built-in values. */
const TIMEOUT_MS = 2500;

/** What the last load did — for the console and for curious developers (window.EC_SETTINGS_STATUS). */
export interface RuntimeSettingsStatus {
  applied: boolean;
  reason: string;
  savedBy?: string;
  savedAt?: string;
  skipped: string[];
}

/**
 * Fetch assets/settings.js from this package and merge it into EC_CONFIG.
 * Resolves in every case (never rejects): failures mean "built-in values".
 */
export async function loadRuntimeSettings(): Promise<RuntimeSettingsStatus> {
  const status: RuntimeSettingsStatus = { applied: false, reason: '', skipped: [] };
  const base = typeof __webpack_public_path__ === 'string' ? __webpack_public_path__ : '';
  if (!base) {
    status.reason = 'package location unknown';
    return finish(status);
  }
  const url = `${base.endsWith('/') ? base : base + '/'}assets/settings.js`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // no-cache = revalidate with the server: an uploaded package is seen at once.
    const res = await fetch(url, { cache: 'no-cache', credentials: 'omit', signal: controller.signal });
    if (!res.ok) {
      status.reason = `${url} answered ${res.status}`;
      return finish(status);
    }
    const envelope = parseEnvelope(await res.text());

    const pageVid = currentVid();
    if (envelope.vid && pageVid && envelope.vid !== pageVid) {
      status.reason = `settings.js is for ${envelope.vid}, this page is ${pageVid} — ignored`;
      return finish(status);
    }

    migrateLegacySettings(envelope.values);
    mergeInPlace(EC_CONFIG as Record<string, any>, envelope.values, '', status.skipped);
    applyLanguages(envelope.languages, status);
    status.applied = true;
    status.savedBy = envelope.savedBy;
    status.savedAt = envelope.savedAt;
    status.reason = 'applied';
  } catch (err) {
    status.reason = (err as Error)?.name === 'AbortError'
      ? `no answer from ${url} within ${TIMEOUT_MS} ms`
      : `could not read ${url}: ${(err as Error)?.message ?? err}`;
  } finally {
    window.clearTimeout(timer);
  }
  return finish(status);
}

/** Log once and expose the status on window for debugging. */
function finish(status: RuntimeSettingsStatus): RuntimeSettingsStatus {
  (window as any).EC_SETTINGS_STATUS = status;
  if (status.applied) {
    console.info(`[ec] settings: assets/settings.js applied (saved by ${status.savedBy ?? '?'}, ${status.savedAt ?? '?'})`);
  } else {
    console.info(`[ec] settings: built-in values used — ${status.reason}`);
  }
  if (status.skipped.length) {
    console.warn(`[ec] settings: ignored ${status.skipped.length} value(s) from settings.js:\n  ${status.skipped.join('\n  ')}`);
  }
  return status;
}

/**
 * The envelope from the file text: the JSON between the first "{" after
 * EC_SETTINGS and the last "}". Same parser as parseSettingsJs in
 * scripts/config-generate.cjs.
 */
function parseEnvelope(text: string): { vid?: string; savedBy?: string; savedAt?: string; languages?: unknown; values: Record<string, any> } {
  const start = text.indexOf('{', text.indexOf('EC_SETTINGS'));
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no "window.EC_SETTINGS = { … }" in the file');
  const envelope = JSON.parse(text.slice(start, end + 1));
  if (!envelope || typeof envelope.values !== 'object' || envelope.values === null) {
    throw new Error('the file has no "values" section');
  }
  return envelope;
}

/**
 * The language list from settings.js (edited in the settings editor) REPLACES
 * the built-in one, English always included:
 *   - a language added there (e.g. "it") is accepted by currentLang(), so
 *     lang=it uses the Italian texts;
 *   - a language removed there is dropped, so lang=de falls back to the
 *     English texts (its built-in texts are no longer used).
 * Only two-letter codes. The generated array is changed in place, because
 * ec-config.ts and others hold a reference to it.
 */
function applyLanguages(list: unknown, status: RuntimeSettingsStatus): void {
  if (!Array.isArray(list)) return;
  const wanted: string[] = ['en'];
  for (const entry of list) {
    const code = typeof entry === 'string' ? entry : (entry as { code?: unknown })?.code;
    if (typeof code !== 'string' || !/^[a-z]{2}$/.test(code)) { status.skipped.push(`languages: "${String(code)}" is not a two-letter code`); continue; }
    if (!wanted.includes(code)) wanted.push(code);
  }
  const known = EC_LANGUAGES as string[];
  known.splice(0, known.length, ...wanted);
}

/**
 * Bring settings from an OLDER package into today's shape, in place, before
 * they are merged. Each step says when its old shape was replaced.
 *
 * TWINS — the same conversion runs wherever a settings.js is read, keep them in step:
 *   src/assets/editor/index.html      migrateLegacySettings()  (package editor + package maker)
 *   scripts/settings-ui/server.cjs    migrateLegacySettings()  (npm run settings → Import settings.js)
 */
export function migrateLegacySettings(values: Record<string, any>): void {
  // Oct 2026 — ONE collection badge → a LIST of badges. Old: libraryOnTheGo =
  // { enabled, collectionId, label, color, infoButtonLabel, dialogTitle,
  //   dialogHtml, closeLabel, pnxEndpoint }. New: { enabled, badges: [ {…} ],
  // closeLabel }. pnxEndpoint is now a constant (record-doc.ts) and dropped.
  const lotg = values?.['libraryOnTheGo'];
  if (lotg && typeof lotg === 'object' && !Array.isArray(lotg) && !('badges' in lotg) && 'collectionId' in lotg) {
    const badge: Record<string, unknown> = {};
    for (const k of ['collectionId', 'label', 'color', 'infoButtonLabel', 'dialogTitle', 'dialogHtml']) {
      if (k in lotg) badge[k] = lotg[k];
      delete lotg[k];
    }
    delete lotg['pnxEndpoint'];
    lotg['badges'] = [badge];
  }

  // Oct 2026 — custom dialogs: the trigger `name` (a plain word: #name links +
  // the class) became `selector` ("Opens from"), where a plain word still means
  // exactly that. A dialog that had both (short-lived) keeps both as one selector.
  const dialogs = values?.['customDialogs']?.['dialogs'];
  if (Array.isArray(dialogs)) {
    for (const d of dialogs) {
      if (!d || typeof d !== 'object' || !('name' in d)) continue;
      const name = String(d['name'] ?? '').trim();
      const sel = String(d['selector'] ?? '').trim();
      d['selector'] = name && sel ? `a[href="#${name}"], .${name}, ${sel}` : (sel || name);
      delete d['name'];
    }
  }
}

/** "string" | "number" | "boolean" | "array" | "object" | "null" | … */
function kindOf(v: unknown): string {
  return Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
}

/**
 * Merge `source` into `target` WITHOUT replacing target's objects (see header).
 * Objects merge key by key; arrays and scalars replace — the same rule as the
 * build-time merge of global.json + view.json. A value whose type differs from
 * the built-in one is skipped. Keys the build does not know are added only when
 * the parent is a free-form map (e.g. Localised texts gaining a language),
 * otherwise skipped — an old/foreign key must not create half-configured features.
 */
function mergeInPlace(target: Record<string, any>, source: Record<string, any>, path: string, skipped: string[]): void {
  for (const [key, value] of Object.entries(source)) {
    const here = path ? `${path}.${key}` : key;
    if (!(key in target)) {
      // A text in a language the build lacks (or a free map entry): accept strings
      // inside objects whose existing values are all strings (Localised maps).
      const isTextMap = Object.values(target).length > 0 && Object.values(target).every((x) => typeof x === 'string');
      if (isTextMap && typeof value === 'string') target[key] = value;
      else skipped.push(`${here} (not a setting of this package version)`);
      continue;
    }
    const current = target[key];
    if (typeof current === 'function') continue; // code (e.g. userInfo.mapResponse) is never replaced
    const want = kindOf(current), got = kindOf(value);
    if (want !== got) {
      skipped.push(`${here} (expected ${want}, got ${got})`);
      continue;
    }
    if (want === 'object') mergeInPlace(current, value, here, skipped);
    else target[key] = value;
  }
}
