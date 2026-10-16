// src/app/shared/record-doc.ts
//
// THE RECORD BEHIND A RESULT ROW — shared by the features on a record's top
// line (EcRecordLineComponent and its children: collection badges, free
// version link). Moved here from ec-library-on-the-go.component.ts (Oct 2026)
// when a second feature needed the same record.
//
// WHERE THE RECORD COMES FROM — two sources, tried in this order:
//   1. The NDE component of the slot (`hostComponent`). Which property holds
//      the record differs per NDE component/release, so findDocOnHost() looks
//      at every property (unwrapping Angular signals) for an object with a
//      `pnx.control` — no property name is hard-coded.
//   2. Fallback when the host does not expose it: the record id is read from
//      the title link in the same row (<a id="record_id_alma…">) and the record
//      is fetched from Primo's own endpoint (PNX_ENDPOINT). One request per
//      record, cached for the page (CACHE).
// If you see many `pnxs/L/…` requests in the Network tab, source 1 is not
// working on this NDE release; the features still work, less efficiently.
//
// A "doc" is what Primo calls a record in its API answers: { pnx, delivery, … }.
// Only the fields the features read are typed below.
import { EC_CONFIG, currentLang, currentVid } from './ec-config';

/** The parts of a Primo record (doc) our features read. */
export interface RecordDoc {
  pnx: {
    control?: { recordid?: string[]; colldiscovery?: string[] };
    /** addata.doi = the DOI(s), e.g. "10.1038/nature12373". */
    addata?: { doi?: string[] };
    display?: { identifier?: string[] };
  };
  /** delivery.availability e.g. ["fulltext"], ["no_fulltext"], ["available_in_library"]. */
  delivery?: { availability?: string[] };
}

/**
 * Primo endpoint returning one record by id — the one NDE uses itself.
 * Placeholders {recordId}, {vid}, {lang}. Was the setting
 * libraryOnTheGo.pnxEndpoint until Oct 2026; nobody ever needed to change it,
 * so it is a constant now (same reasoning as the return-label constants).
 */
const PNX_ENDPOINT = '/primaws/rest/pub/pnxs/L/{recordId}?vid={vid}&lang={lang}';

/** Fallback fetches by record id, shared by every row: a record shown twice is requested once. */
const CACHE = new Map<string, Promise<RecordDoc | null>>();

/**
 * Look on the NDE host component for the record: a value (or the value inside
 * an Angular signal) that has `pnx.control` is the doc; a value that itself
 * has `control.recordid` is a bare PNX (then without delivery).
 */
export function findDocOnHost(host: any): RecordDoc | null {
  if (!host || typeof host !== 'object') return null;
  for (const key of Object.keys(host)) {
    let value: any;
    try {
      value = unwrapSignal(host[key]);
    } catch {
      continue; // a getter/signal that throws is simply not our record
    }
    if (value?.pnx?.control) return value as RecordDoc;
    if (Array.isArray(value?.control?.recordid)) return { pnx: value };
  }
  return null;
}

/** Record id from the title link of the row `el` is in: <a id="record_id_alma996…">. */
export function recordIdFromRow(el: Element): string {
  const row = el.closest('nde-search-result-item-container');
  const id = row?.querySelector('a[id^="record_id_"]')?.id ?? '';
  return id.replace(/^record_id_/, '');
}

/**
 * Fetch one record from Primo. Sends the session JWT like NDE does (guests
 * have a guest JWT). Resolves to null on any failure — features then simply
 * show nothing for that record.
 */
export function fetchDoc(recordId: string): Promise<RecordDoc | null> {
  let pending = CACHE.get(recordId);
  if (!pending) {
    pending = (async () => {
      const url = PNX_ENDPOINT
        .replace('{recordId}', encodeURIComponent(recordId))
        .replace('{vid}', encodeURIComponent(currentVid()))
        .replace('{lang}', encodeURIComponent(currentLang()));
      const headers: Record<string, string> = { Accept: 'application/json' };
      try {
        // Primo stores the JWT JSON-stringified (with quotes) in sessionStorage.
        const jwt = sessionStorage.getItem(EC_CONFIG.userInfo.jwtStorageKey)?.replace(/^"|"$/g, '');
        if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
        const res = await fetch(url, { headers, credentials: 'same-origin' });
        if (!res.ok) {
          console.warn(`[ec] record line: record request failed: ${res.status} ${url}`);
          return null;
        }
        const body = await res.json();
        // The endpoint answers with the doc ({ pnx, delivery }) — or, on some
        // releases, the bare PNX.
        return body?.pnx ? (body as RecordDoc) : ({ pnx: body } as RecordDoc);
      } catch (err) {
        console.warn('[ec] record line: record request errored', err);
        return null;
      }
    })();
    CACHE.set(recordId, pending);
  }
  return pending;
}

/**
 * Angular signals are zero-argument functions carrying a symbol-keyed marker
 * property; plain methods have none. Only such functions are called — never an
 * arbitrary method of the NDE component.
 */
function unwrapSignal(value: any): any {
  if (typeof value === 'function' && value.length === 0 && Object.getOwnPropertySymbols(value).length > 0) {
    return value();
  }
  return value;
}
