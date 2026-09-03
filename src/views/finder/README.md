# Find-eR — `32EUC_INST:VU2`

| File | Purpose |
|---|---|
| `mappings.ts` | Selector → component map for this view (shared mappings + view-specific ones) |
| `theme.scss` | Entry point compiled to `custom.css` for this view |
| `assets/` | View-specific assets. Overrides files with the same path in `src/assets/` (shared). Put `images/library-logo.png`, homepage HTML, etc. here |

Build: `npm run build -- finder` → `dist/32EUC_INST-VU2.zip`
Serve: `npm run start:proxy -- finder` → http://localhost:4201/nde/home?vid=32EUC_INST:VU2
Live: https://ec-europa-finder.primo.exlibrisgroup.com/nde/home?vid=32EUC_INST:VU2
