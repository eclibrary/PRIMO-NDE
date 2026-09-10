# Print return label (Find-eR) — Europa dropped, label page now in the package

Drop `src/` and `scripts/` over the repo root (merge, replace when asked). Then add to package.json:
    "alma:libraries": "node scripts/alma-libraries.cjs",
and to .env:
    ALMA_CONF_API_KEY=l8xx…   (read-only Configuration key; optional — builds work without it)

## Added
- `src/views/finder/assets/return-label/{index.html,label.css,label.js}` — the label page, replacing
  ec.europa.eu/libraries/pages/printreturnlabel. Same parameters as before (`librarycode`, `userlocation`,
  `address`) plus `lang`. Live URL:
    https://ec-europa-finder.primo.exlibrisgroup.com/custom/32EUC_INST-VU2/assets/return-label/index.html?librarycode=BCB
  → update the links in the Alma letters to this.
- `src/assets/data/libraries.js` — initial snapshot converted from library-addresses.csv (19 libraries,
  `returnAddress` lines per code), as a script setting `window.EC_LIBRARIES` because Alma rejects `.json`
  in customization packages. `npm run alma:libraries` refreshes codes/names from Alma.
- `data/libraries.overrides.json` (repo root, NOT in the package) — the return addresses (Alma's API does
  not carry them); merged over every refresh. Edit here when a library moves, then run the script.
- `src/views/finder/components/ec-print-return-label/` + mapping on `nde-loan-item-after`.
- `scripts/alma-libraries.cjs`; `scripts/build.cjs` refreshes the snapshot on production builds when a key is set.

## Changed
- `ec-config.ts`: `EcUserInfo.unit` (address2) and `.city` (address4) mapped from personal_settings.

## Verify
1. Library card → Loans: link under each active loan; none under returned loans.
   No link + console warning `[ec] print-return-label` → read the library-code path off the logged object
   and update `CONFIG.codePaths`.
2. Click → new tab with the label, print dialog opens; `?lang=fr` gives French instructions.
3. Open the live URL above directly (no sign-in needed) — that is what the e-mail links will do.
4. If the label page shows the error text: check `assets/data/libraries.js` is in the deployed zip and the
   code in the URL exists in it.
