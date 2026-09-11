# Settings step 1 — values moved from TypeScript to JSON (no behaviour change)

Drop on the REPO ROOT (merge, replace when asked). Branch: settings-ui.

## Added
- config/schema.json, config/global.json, config/views/{finder,pubs,ecdata,country}.json
- scripts/config-generate.cjs  (+ "config:generate" in package.json)
- src/app/shared/ec-config.generated.ts  — generated for finder so the editor is happy now;
  git-ignored from here on (prebuild regenerates it for whichever view you build)
- src/app/shared/components/ec-libchat/ec-libchat.component.ts  — LibChat (was pending)
- docs/SETTINGS.md

## Changed
- prebuild.js — calls the generator (NDE_VIEW → that view's merged config)
- src/app/shared/ec-config.ts — types + helpers + mapResponse only; values come from the generated file
- ec-ask-librarian.component.ts — reads `hideFields` (per view via config/views/<view>.json) instead of `perView[vid]`
- ec-print-return-label.component.ts — reads `EC_CONFIG.printReturnLabel` (config/views/finder.json)
- ec-shared-root.component.ts — mounts LibChat; TODO note about the every-page slot
- .gitignore, package.json

## Verify
1. `npm run build -- finder` — prebuild prints "[config] wrote … for finder"; build succeeds.
2. Break something on purpose (e.g. "maxAgeDays": "x" in config/global.json) → build stops with the path.
3. Deployed package behaves exactly as before (modal, last search, return label) + the chat button appears.
