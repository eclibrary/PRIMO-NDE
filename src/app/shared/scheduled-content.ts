// src/app/shared/scheduled-content.ts
//
// SCHEDULED CONTENT — show a part of the home page, header or footer only
// between two dates, without having to remember to edit the HTML on the day:
//
//     <p data-ec-from="2026-12-20" data-ec-until="2027-01-04">
//       The library is closed during the Christmas holidays.
//     </p>
//
//   data-ec-from="YYYY-MM-DD"    shown from the START of that day
//   data-ec-until="YYYY-MM-DD"   shown until the END of that day (included)
//   Either may be left out (from only = "from that day on", until only =
//   "until that day"). A time may be added: "2026-12-20T14:00" (from/until
//   that minute exactly). Dates are the visitor's local dates.
//
// HIDE UNLESS (the rule for all conditional content, _ec-conditional.scss):
// an element with data-ec-from / data-ec-until is HIDDEN by the stylesheet
// until this code has checked it and given it the class `ec-in-schedule`.
// So it never flashes up and disappears, and it stays hidden on a page where
// the module did not load — the safe side for "not yet" / "no longer" notices.
//
// A date the code cannot read (typo) counts as "no limit" for that side, with
// one console warning, so a typo never hides content for good.
//
// WHEN: started from bootstrap.ts (no Angular needed), so it works on every
// page, in the home page as well as in the header and footer. Elements that
// appear later (NDE loads the home page HTML after the shell) are picked up
// by a MutationObserver; every minute all of them are checked again, so a page
// left open past midnight (or past a given time) changes by itself.
//
// NOT IN: custom dialogs, notice banners and other texts from the settings —
// those are sanitised and lose data-* attributes. Banners have their own dates.

/** Class that lets a scheduled element show (see _ec-conditional.scss). */
const IN_CLASS = 'ec-in-schedule';
/** The elements this module looks after. */
const SELECTOR = '[data-ec-from], [data-ec-until]';
/** Re-check everything this often (ms), for pages left open. */
const RECHECK_MS = 60 * 1000;

/** Values already warned about, so a typo is logged once, not every minute. */
const warned = new Set<string>();

/**
 * Moment a "from"/"until" value stands for, in ms — or null when empty or not
 * understood. Date only: from = start of the day, until = start of the NEXT
 * day (the whole day is included). With a time: exactly that minute.
 */
export function scheduleBound(value: string | null | undefined, side: 'from' | 'until'): number | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(v);
  if (!m) {
    if (!warned.has(v)) {
      warned.add(v);
      console.warn(`[ec] schedule: "${v}" is not a date (YYYY-MM-DD or YYYY-MM-DDTHH:MM) — ignored`);
    }
    return null;
  }
  const [, y, mo, d, h, mi] = m;
  if (h !== undefined) return new Date(+y, +mo - 1, +d, +h, +mi).getTime();
  // Local midnight; `until` → next midnight (new Date handles month ends).
  return new Date(+y, +mo - 1, +d + (side === 'until' ? 1 : 0)).getTime();
}

/** True when `now` lies between from (included) and until (excluded, see scheduleBound). */
export function isWithinSchedule(from: string | null | undefined, until: string | null | undefined, now = Date.now()): boolean {
  const start = scheduleBound(from, 'from');
  const end = scheduleBound(until, 'until');
  return (start === null || now >= start) && (end === null || now < end);
}

/** Give/take IN_CLASS on every scheduled element in `root`. */
function checkAll(root: ParentNode = document): void {
  const now = Date.now();
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    el.classList.toggle(IN_CLASS, isWithinSchedule(el.getAttribute('data-ec-from'), el.getAttribute('data-ec-until'), now));
  });
}

/** Start watching the page. Called once from bootstrap.ts. */
export function startScheduledContent(): void {
  let queued = false;
  // Batch DOM changes to one check per animation frame: NDE changes the DOM a
  // lot, and querySelectorAll over the page is cheap but not free.
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; checkAll(); });
  };
  const begin = () => {
    checkAll();
    new MutationObserver(queue).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-ec-from', 'data-ec-until'],
    });
    window.setInterval(() => checkAll(), RECHECK_MS);
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
}
