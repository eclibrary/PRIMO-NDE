// src/app/shared/opening-hours.ts
//
// OPENING HOURS — settings openingHours: the weekly hours plus exceptions
// (holidays, closures, special hours), shown in three ways:
//
//   1. TODAY — any element with data-ec-opening-hours (or ="today") in the
//      home page, header or footer gets one line:
//          Today: 09:00–17:00  [Open now]  All opening hours
//      "Open now" / "Closed now" is a badge (re-checked every minute); "All
//      opening hours" opens the pop-up (setting weekLinkLabel, empty = no link).
//          <p data-ec-opening-hours></p>
//   2. WEEK — data-ec-opening-hours="week": the table Monday–Sunday (today
//      highlighted) and the coming exceptions, right in the page.
//          <div data-ec-opening-hours="week"></div>
//   3. POP-UP — any link to #ec-opening-hours opens a dialog with the week:
//          <a href="#ec-opening-hours">Opening hours</a>
//
// HIDE UNLESS (as all conditional content, _ec-conditional.scss): placeholders
// are hidden by the stylesheet until filled here (class ec-oh--ready). Switched
// off, or the module not loaded: they stay hidden — no empty boxes.
//
// HOURS FORMAT (settings, also checked by the editors): "09:00-17:00", several
// periods comma-separated "09:00-12:30, 13:30-17:00", empty = closed. Shown
// with an en dash. A period ending at or before it starts ("20:00-02:00") is
// taken to end at midnight — opening past midnight is not supported.
//
// EXCEPTIONS: { from, until, hours, note }. A day between from and until
// (included; until empty = from only) uses the exception's hours instead of
// the weekday's; the first matching exception wins. Past ones are ignored.
//
// TIME ZONE: "Open now" and "today" are worked out in the setting timeZone
// (e.g. Europe/Brussels), so a visitor abroad sees the library's day. Empty
// or unknown zone: the visitor's computer clock.
//
// PLAIN DOM, NO ANGULAR: started from bootstrap.ts, like the notice banners,
// so it also works in the header and footer of pages without our components.
// Texts from the settings are inserted as TEXT (textContent), never as HTML.
import { EC_CONFIG, EcOpeningHoursException, EcWeekday, currentLang, localised } from './ec-config';

/** Monday first — the order of the week table and of the settings. */
const DAYS: EcWeekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
/** Placeholders this module fills. */
const SELECTOR = '[data-ec-opening-hours]';
/** Links that open the pop-up. */
const LINK_HASH = '#ec-opening-hours';
/** Re-render this often (ms): "Open now" changes with the clock. */
const RECHECK_MS = 60 * 1000;
/** At most this many coming exceptions are listed. */
const MAX_EXCEPTIONS = 8;

/** "Now" as the library sees it. */
interface LibraryNow {
  /** "YYYY-MM-DD". */
  date: string;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  /** Minutes since midnight. */
  minutes: number;
}

/** The hours that apply to one day. */
interface DayHours {
  /** As in the settings ("" = closed). */
  raw: string;
  /** Parsed periods in minutes [start, end); null = could not be read. */
  periods: Array<[number, number]> | null;
  /** Note of the exception that applies, else ''. */
  note: string;
}

let dialog: HTMLDialogElement | null = null;

/** Start. Called once from bootstrap.ts. */
export function startOpeningHours(): void {
  const cfg = EC_CONFIG.openingHours;
  if (!cfg?.enabled) return;

  // Pop-up links: capture phase, so NDE's router never sees "#ec-opening-hours".
  document.addEventListener('click', (ev) => {
    const a = (ev.target as Element | null)?.closest?.('a[href]');
    if (!a || a.getAttribute('href') !== LINK_HASH) return;
    ev.preventDefault();
    ev.stopPropagation();
    openDialog();
  }, true);

  const begin = () => {
    fillAll(true);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fillAll(false); });
    }).observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => fillAll(true), RECHECK_MS);
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
}

// --------------------------------------------------------------- rendering

/**
 * Fill the placeholders. `all` = also the ones already filled (the minute
 * tick); otherwise only new ones (DOM changes), so our own changes do not
 * cause endless re-rendering.
 */
function fillAll(all: boolean): void {
  const now = libraryNow();
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (!all && el.classList.contains('ec-oh--ready')) return;
    const mode = el.getAttribute('data-ec-opening-hours') === 'week' ? 'week' : 'today';
    el.replaceChildren(mode === 'week' ? weekView(now) : todayLine(now));
    el.classList.add('ec-oh', `ec-oh--${mode}`, 'ec-oh--ready');
  });
  if (dialog?.open) dialog.querySelector('.ec-oh-dialog__body')!.replaceChildren(weekView(now));
}

/** "Today: 09:00–17:00  [Open now]  All opening hours". */
function todayLine(now: LibraryNow): DocumentFragment {
  const cfg = EC_CONFIG.openingHours!;
  const lang = currentLang();
  const today = hoursOn(now.date, now.weekday);
  const frag = document.createDocumentFragment();

  const icon = span('material-symbols-outlined ec-oh__icon', 'schedule');
  icon.setAttribute('aria-hidden', 'true');
  const text = (localised(cfg.todayLabel, lang) || '{hours}').replace('{hours}', display(today));
  frag.append(icon, span('ec-oh__today', text + (today.note ? ` (${today.note})` : '')));

  // Badge only when the hours could be read (a typo shows the text, no claim).
  if (today.periods) {
    const open = today.periods.some(([s, e]) => now.minutes >= s && now.minutes < e);
    frag.append(' ', span(`ec-oh__status ec-oh__status--${open ? 'open' : 'closed'}`,
      localised(open ? cfg.openNowLabel : cfg.closedNowLabel, lang)));
  }

  const more = localised(cfg.weekLinkLabel, lang);
  if (more) {
    const a = document.createElement('a');
    a.href = LINK_HASH;
    a.className = 'ec-oh__more';
    a.textContent = more;
    frag.append(' ', a);
  }
  return frag;
}

/** The week table + coming exceptions. */
function weekView(now: LibraryNow): HTMLElement {
  const cfg = EC_CONFIG.openingHours!;
  const lang = currentLang();
  const wrap = document.createElement('div');

  const table = document.createElement('table');
  table.className = 'ec-oh__table';
  const body = table.createTBody();
  DAYS.forEach((day, i) => {
    const row = body.insertRow();
    // Today's row: highlighted, and with today's EFFECTIVE hours (an exception
    // today shows here); the other rows show the regular hours.
    const isToday = i === now.weekday;
    const hours = isToday ? hoursOn(now.date, i) : regular(day);
    if (isToday) { row.className = 'ec-oh__row--today'; row.setAttribute('aria-current', 'date'); }
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = dayName(i, lang);
    const td = row.insertCell();
    td.textContent = display(hours) + (hours.note ? ` (${hours.note})` : '');
    row.insertBefore(th, td);
  });
  wrap.append(table);

  const coming = comingExceptions(now.date);
  if (coming.length) {
    const h = document.createElement('h3');
    h.className = 'ec-oh__exceptions-title';
    h.textContent = localised(cfg.exceptionsTitle, lang);
    const ul = document.createElement('ul');
    ul.className = 'ec-oh__exceptions';
    for (const ex of coming) {
      const li = document.createElement('li');
      const until = ex.until && ex.until !== ex.from ? ` – ${formatDate(ex.until, lang)}` : '';
      const note = ex.note ? localised(ex.note, lang) : '';
      li.textContent = `${formatDate(ex.from, lang)}${until}: ${display(parseDay(ex.hours ?? '', note))}${note ? ` (${note})` : ''}`;
      ul.append(li);
    }
    wrap.append(h, ul);
  }
  return wrap;
}

function span(className: string, text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}

// ------------------------------------------------------------------ pop-up

/** Build once (plain <dialog>: focus trap, Esc, backdrop for free); styles in _ec-features.scss. */
function openDialog(): void {
  const cfg = EC_CONFIG.openingHours!;
  const lang = currentLang();
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'ec-oh-dialog';
    dialog.setAttribute('aria-labelledby', 'ec-oh-dialog-title');
    dialog.innerHTML = `
      <div class="ec-oh-dialog__bar"><h2 class="ec-oh-dialog__title" id="ec-oh-dialog-title"></h2></div>
      <div class="ec-oh-dialog__body"></div>
      <div class="ec-oh-dialog__footer"><button type="button" class="ec-oh-dialog__close" autofocus></button></div>`;
    dialog.querySelector('.ec-oh-dialog__title')!.textContent = localised(cfg.dialogTitle, lang);
    const close = dialog.querySelector<HTMLButtonElement>('.ec-oh-dialog__close')!;
    close.textContent = localised(cfg.closeLabel, lang) || 'Close';
    close.addEventListener('click', () => dialog!.close());
    // A click on the backdrop (the <dialog> itself, not its content) closes it.
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog!.close(); });
    document.body.appendChild(dialog);
  }
  dialog.querySelector('.ec-oh-dialog__body')!.replaceChildren(weekView(libraryNow()));
  try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
}

// ------------------------------------------------------------------- hours

/** Regular hours of a weekday. */
function regular(day: EcWeekday): DayHours {
  return parseDay(EC_CONFIG.openingHours!.week?.[day] ?? '', '');
}

/** Effective hours on a date: the first matching exception, else the weekday's. */
function hoursOn(date: string, weekday: number): DayHours {
  const lang = currentLang();
  for (const ex of exceptions()) {
    if (date >= ex.from && date <= (ex.until || ex.from)) {
      return parseDay(ex.hours ?? '', ex.note ? localised(ex.note, lang) : '');
    }
  }
  return regular(DAYS[weekday]);
}

/** Valid exceptions (a from date in YYYY-MM-DD form). Dates compare as strings. */
function exceptions(): EcOpeningHoursException[] {
  const list = EC_CONFIG.openingHours!.exceptions;
  return Array.isArray(list) ? list.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.from ?? '')) : [];
}

/** Exceptions that have not ended yet, soonest first. */
function comingExceptions(today: string): EcOpeningHoursException[] {
  return exceptions()
    .filter((e) => (e.until || e.from) >= today)
    .sort((a, b) => a.from.localeCompare(b.from))
    .slice(0, MAX_EXCEPTIONS);
}

/** "09:00-12:30, 13:30-17:00" → periods in minutes; "" → [] (closed); unreadable → null. */
function parseDay(raw: string, note: string): DayHours {
  const text = (raw ?? '').trim();
  if (!text) return { raw: '', periods: [], note };
  const periods: Array<[number, number]> = [];
  for (const part of text.split(',')) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(part);
    if (!m) return { raw: text, periods: null, note };
    const start = +m[1] * 60 + +m[2];
    let end = +m[3] * 60 + +m[4];
    if (end <= start) end = 24 * 60; // see HOURS FORMAT: no opening past midnight
    periods.push([start, end]);
  }
  return { raw: text, periods, note };
}

/** "09:00–17:00, …" for display; "Closed" for a closed day; the raw text if unreadable. */
function display(h: DayHours): string {
  if (h.periods === null) return h.raw;
  if (h.periods.length === 0) return localised(EC_CONFIG.openingHours!.closedLabel, currentLang()) || 'Closed';
  const t = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  return h.periods.map(([s, e]) => `${t(s)}–${e === 24 * 60 ? '24:00' : t(e)}`).join(', ');
}

// -------------------------------------------------------------- date & time

/** Date, weekday and minutes now in the library's time zone (setting timeZone). */
function libraryNow(): LibraryNow {
  const zone = EC_CONFIG.openingHours!.timeZone || undefined;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date());
  } catch {
    // Unknown zone name: the visitor's clock (logged once).
    if (!zoneWarned) { zoneWarned = true; console.warn(`[ec] opening hours: unknown time zone "${zone}" — using the visitor's clock`); }
    parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date());
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: weekday < 0 ? 0 : weekday,
    minutes: +get('hour') * 60 + +get('minute'),
  };
}
let zoneWarned = false;

/** Day name in the interface language, 0 = Monday. 1 Jan 2024 was a Monday. */
function dayName(index: number, lang: string): string {
  const name = new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + index)));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "2026-12-24" → "24 December 2026" in the interface language (a calendar date: no zone shift). */
function formatDate(iso: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}
