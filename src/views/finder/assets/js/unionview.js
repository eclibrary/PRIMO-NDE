/*
  unionview.js — EC's contribution to the EULibCat union catalogue (NDE).
  (Named after the union view rather than EULibCat — the name the other
  institutions already use; formerly eulibcat.js.)

  WHERE IT LIVES   src/views/finder/assets/js/unionview.js in the EC views repo → shipped
                   in the Find-eR package only. The union package loads it from:
                   https://ec-europa-finder.primo.exlibrisgroup.com/nde/custom/32EUC_INST-VU2/assets/js/unionview.js

  WHO LOADS IT     EULibCat's own custom.js, after sign-in, once the vid's institution
                   part reads 32EUC_INST (the vid switches from 32EU_DN:EULIBCAT_UNION to
                   32EUC_INST:EULIBCAT_UNION for EC patrons). Find-eR itself never loads it.

  WHAT IT DOES     For Resource Sharing requests in the union view: forces the Format to
                   PHYSICAL, hides the field (production hosts only), re-runs "Check
                   availability". Everything through the rendered DOM — plain browser JS,
                   no Angular, no dependency on how the union package is built.

  CONSTRAINTS      Keep it dependency-free and self-contained; other institutions will
                   copy the pattern for their own unionview.js.

  LOGGING          One console line per step, prefixed "[ec:unionview]".
*/
(() => {
  'use strict';

  // ------------------------------------------------------------------ settings
  const SETTINGS = {
    /** 'physical' | 'digital' | 'photocopy' | '' ('' = leave the choice to the patron) */
    forceFormat: 'physical',
    /** Move the Format field off screen once forced (production hosts only). */
    hideFormatField: true,
    /** Click "Check availability" after forcing, as the VE script did. */
    autoCheckAvailability: true,
    /** NDE markup — change only if Ex Libris changes it. */
    formatFieldSelector: '[data-qa="almaResourceSharing.format"]',
    checkAvailabilitySelector: 'nde-formly-check-availability-button button',
    /**
     * Options are matched by POSITION, not by label: labels are translated,
     * positions follow Alma's fixed order (Physical, Digital, Photocopy).
     */
    positions: { physical: 0, digital: 1, photocopy: 2 },
  };

  const LOCKED_CLASS = 'ec-rs-format-locked';
  const log = (msg, ...rest) => console.info(`[ec:unionview] ${msg}`, ...rest);

  // Guard: the union package may inject this script more than once per page life.
  if (window.__ecEulibcatLoaded) { log('already loaded — skipping'); return; }
  window.__ecEulibcatLoaded = true;
  log(`loaded (resource sharing format: ${SETTINGS.forceFormat || 'not forced'})`);

  // The union page has no EC stylesheet, so the "locked field" rule is injected here.
  // Off screen rather than display:none, so the control stays in the form and is submitted.
  const sandbox = /-psb\.primo\.exlibrisgroup\.com$/.test(window.location.hostname);
  if (sandbox) {
    log('sandbox host: the forced field stays visible for testing');
  } else {
    const style = document.createElement('style');
    style.dataset.ecEulibcat = '1';
    style.textContent = `.${LOCKED_CLASS}{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}`;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------ helpers

  /** Wait (≤ timeoutMs) for the Format field under `root`; null if it never appears. */
  function waitForFormatField(root, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const field = root.querySelector(SETTINGS.formatFieldSelector);
        if (field) return resolve(field);
        if (Date.now() - started > timeoutMs) return resolve(null);
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  /** Open the Material select and click the option at `position`; skip if already selected. */
  function selectByPosition(field, position) {
    return new Promise((resolve) => {
      const trigger = field.querySelector('mat-select');
      if (!trigger) return resolve(false);
      trigger.click(); // opens the option panel (rendered at document level)
      setTimeout(() => {
        const panel = (trigger.id && document.getElementById(`${trigger.id}-panel`)) || document.querySelector('.mat-mdc-select-panel');
        const options = panel ? Array.from(panel.querySelectorAll('mat-option')) : [];
        const option = options[position];
        if (!option) {
          log(`option #${position} not found (${options.length} options)`);
          trigger.click(); // close the panel again
          return resolve(false);
        }
        const label = (option.textContent || '').trim();
        if (option.getAttribute('aria-selected') === 'true') {
          log(`already "${label}" (option #${position})`);
          trigger.click(); // close
        } else {
          option.click();
          log(`set via select: option #${position} "${label}"`);
        }
        resolve(true);
      }, 80);
    });
  }

  /** Full sequence for one request dialog. Silently ignores dialogs without a Format field. */
  async function handleDialog(dialog) {
    if (!SETTINGS.forceFormat) return;
    const field = await waitForFormatField(dialog);
    if (!field) return; // hold / digitization / purchase forms have no Format — nothing to do
    const ok = await selectByPosition(field, SETTINGS.positions[SETTINGS.forceFormat]);
    if (!ok) { log('could not set the format (mat-select not found)'); return; }
    if (SETTINGS.hideFormatField) { field.classList.add(LOCKED_CLASS); log('Format field hidden'); }
    if (SETTINGS.autoCheckAvailability) {
      setTimeout(() => {
        const btn = dialog.querySelector(SETTINGS.checkAvailabilitySelector);
        log(btn ? 'Check availability clicked' : `Check availability button not found (${SETTINGS.checkAvailabilitySelector})`);
        if (btn) btn.click();
      }, 150);
    }
  }

  // ------------------------------------------------------------------ wiring

  // Request dialogs are created on demand at document level: watch for them,
  // handle each once. (A dialog may already be open when this script arrives.)
  const seen = new WeakSet();
  const handle = (node) => { if (!seen.has(node)) { seen.add(node); handleDialog(node); } };

  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (n.matches('mat-dialog-container')) handle(n);
        else n.querySelectorAll('mat-dialog-container').forEach(handle);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('mat-dialog-container').forEach(handle);
})();
