# Tracking the Ex Libris upstream

This repo is ExLibrisGroup/customModule plus a thin multi-view layer. Ex Libris ships updates
to customModule in step with NDE releases, so keep it mergeable.

## One-time setup

```bash
git remote add upstream https://github.com/ExLibrisGroup/customModule.git
git fetch upstream
```

## Pulling an upstream release

```bash
git fetch upstream
git merge upstream/main        # or: git rebase upstream/main if you prefer linear history
npm install
npm run views:sync             # re-generates the per-view configurations in angular.json
npm run build:all              # sanity check
```

## What we changed in upstream files (expect conflicts only here)

Every change is marked with a `[nde-views]` comment.

| File | Change |
|---|---|
| `postbuild.js` | `INST_ID`/`VIEW_ID` come from `scripts/view-context.cjs` (views.config.json + active view) instead of `build-settings.env` |
| `webpack.config.js` | `CopyWebpackPlugin` copies `src/assets` then overlays `src/views/<view>/assets` with `force: true` |
| `proxy/proxy-utils.mjs` | Dist root = active view's dist; view assets resolved before shared; `HTTPS_PROXY` support via `https-proxy-agent` |
| `proxy/proxy.const.mjs` | Target resolved from the active view's host in `views.config.json` |
| `package.json` | Scripts routed through `scripts/*.cjs`; `https-proxy-agent` dev dependency |
| `angular.json` | Per-view `configurations` (build + serve). **Generated** by `npm run views:sync` — do not hand-edit those blocks; resolve a conflict by taking either side and re-running the sync |
| `build-settings.env` | `INST_ID`/`VIEW_ID` removed; only the add-on knobs remain |
| `src/app/custom1-module/customComponentMappings.ts` | Now a fallback that exposes shared mappings only; replaced per view via `fileReplacements` |

Everything else we own lives outside upstream's footprint: `views.config.json`, `scripts/`, `src/app/shared/`, `src/views/`, `docs/`.

## If upstream changes the build pipeline

The layer depends on three upstream behaviours. If any of them changes, adjust the matching file:

1. `ng build` outputs to `dist/custom-module` and `postbuild.js` renames it → `postbuild.js`
2. `angular.json` `assets`/`styles` arrays and `fileReplacements` under the `ngx-build-plus:browser` builder → `scripts/sync-views.cjs`
3. The proxy serves `dist/<INST>-<VIEW>` + a live assets folder → `proxy/proxy-utils.mjs`

## Known upstream quirk

`tests/asset-manifest.test.js` imports `writeAssetManifest` from `postbuild.js`, which upstream never exported; those tests fail on a pristine checkout too. Ignore until Ex Libris fixes them.
