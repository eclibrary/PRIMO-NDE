# Publications — `32EUC_INST:PUBS`

| File | Purpose |
|---|---|
| `mappings.ts` | Selector → component map for this view (shared mappings + view-specific ones) |
| `theme.scss` | Entry point compiled to `custom.css` for this view |
| `assets/` | View-specific assets. Overrides files with the same path in `src/assets/` (shared). Put `images/library-logo.png`, homepage HTML, etc. here |

Build: `npm run build -- pubs` → `dist/32EUC_INST-PUBS.zip`
Serve: `npm run start:proxy -- pubs` → http://localhost:4201/nde/home?vid=32EUC_INST:PUBS
Live: https://ec-europa-finder.primo.exlibrisgroup.com/nde/home?vid=32EUC_INST:PUBS
