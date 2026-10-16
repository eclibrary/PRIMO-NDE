/*
  Return label page logic (see index.html for the URL contract).
  Plain browser JS, no build step: this file is served as-is from the package.
*/
(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('lang') || 'en').slice(0, 2).toLowerCase();
  // On-screen text (never printed). Languages of the views (config/languages.json)
  // that are missing here show English — add an entry to translate this page too.
  const TEXTS = {
    en: {
      instructions: 'Print this label and stick it on an envelope containing the item to be returned. Internal post will take care of the rest.',
      print: 'Print',
      thanks: 'Thank you!',
      error: 'Sorry, no return address could be found for this loan. Please contact the library.',
    },
    fr: {
      instructions: 'Imprimez cette étiquette et collez-la sur une enveloppe contenant le document à rendre. Le courrier interne se charge du reste.',
      print: 'Imprimer',
      thanks: 'Merci !',
      error: 'Désolé, aucune adresse de retour n’a été trouvée pour ce prêt. Veuillez contacter la bibliothèque.',
    },
    de: {
      instructions: 'Drucken Sie dieses Etikett aus und kleben Sie es auf einen Umschlag mit dem zurückzugebenden Medium. Die Hauspost erledigt den Rest.',
      print: 'Drucken',
      thanks: 'Vielen Dank!',
      error: 'Leider wurde für diese Ausleihe keine Rücksendeadresse gefunden. Bitte wenden Sie sich an die Bibliothek.',
    },
  };
  const lang = TEXTS[code] ? code : 'en';
  const TEXT = TEXTS[lang];

  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = TEXT[el.dataset.i18n];
  document.getElementById('print').addEventListener('click', () => window.print());

  // City → resource-sharing library, used when the loan's own library is unknown.
  const FALLBACK_BY_CITY = { BRU: 'RES_SHARE', LUX: 'RSLUX' };

  /**
   * Libraries keyed by code: { BCB: { name, returnAddress: [...] }, … }.
   *
   * 1. ../settings.js — the package's settings file, whose "libraries" section is
   *    edited with the settings editor (assets/editor/index.html → Return labels).
   *    Fetched as TEXT and JSON-parsed, never executed (same rule as the custom
   *    module, runtime-settings.ts): the file is meant to be edited by hand-ish
   *    tools, so it must not be able to run code on this page.
   * 2. window.EC_LIBRARIES from ../data/libraries.js (loaded by index.html before
   *    this file) — the addresses the package was built with. Used when
   *    settings.js is missing, unreadable, has no "libraries" (older package) or
   *    the page is opened from disk (file:// cannot fetch).
   */
  async function loadLibraries() {
    try {
      const res = await fetch('../settings.js', { cache: 'no-cache', credentials: 'omit' });
      if (res.ok) {
        const text = await res.text();
        const start = text.indexOf('{', text.indexOf('EC_SETTINGS'));
        const end = text.lastIndexOf('}');
        const envelope = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
        const libs = envelope && envelope.libraries;
        if (libs && typeof libs === 'object' && !Array.isArray(libs) && Object.keys(libs).length) return libs;
      }
    } catch (err) {
      console.info('[return-label] settings.js not usable, using libraries.js:', err && err.message);
    }
    const data = window.EC_LIBRARIES;
    if (!data || !data.libraries) throw new Error('neither settings.js nor libraries.js provided the libraries');
    return data.libraries;
  }

  /** Lines to print for a library: explicit returnAddress, else derived from an Alma address block. */
  function linesFor(lib) {
    if (!lib) return null;
    if (Array.isArray(lib.returnAddress) && lib.returnAddress.length) return lib.returnAddress;
    const a = lib.address;
    if (!a) return null;
    return [lib.name, 'European Commission', a.line1, a.line2, a.line3, [a.postalCode, a.city].filter(Boolean).join(' ')]
      .filter((l) => l && String(l).trim());
  }

  let lines = null;
  try {
    const libraries = await loadLibraries();
    // 1) the loan's library
    const code = params.get('librarycode');
    if (code) lines = linesFor(libraries[code.trim()]);
    // 2) the patron's city → resource-sharing library
    if (!lines && params.has('userlocation')) {
      const city = String(params.get('userlocation')).trim().toUpperCase();
      lines = linesFor(libraries[FALLBACK_BY_CITY[city]]);
    }
  } catch (err) {
    console.error('[return-label]', err);
  }
  // 3) legacy explicit address (kept for old e-mail links)
  if (!lines && params.get('address')) {
    lines = decodeURIComponent(params.get('address')).split(';').map((s) => s.trim()).filter(Boolean);
  }

  const label = document.getElementById('label');
  label.textContent = '';
  if (!lines) {
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = TEXT.error;
    label.appendChild(p);
    return;
  }
  for (const line of lines) {
    const div = document.createElement('div');
    div.textContent = line; // textContent: the data is ours, but never trust a URL param into innerHTML
    label.appendChild(div);
  }
  document.title = `${lines[0]} — return label`;

  // Open the print dialog once the label is on screen; the button remains for a second copy.
  setTimeout(() => window.print(), 800);
})();
