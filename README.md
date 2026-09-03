# EC Library — Primo NDE views

Customization packages for the four EC Library NDE views, built from one codebase:

| Key | View | Label | Host |
|---|---|---|---|
| `finder` | `32EUC_INST:VU2` | Find-eR | ec-europa-finder.primo.exlibrisgroup.com |
| `pubs` | `32EUC_INST:PUBS` | Publications | ec-europa-finder.primo.exlibrisgroup.com |
| `ecdata` | `32EUC_INST:EC_DATA_NDE` | EC Data | ec-data-catalogue.primo.exlibrisgroup.com (alias; also on ec-europa-finder) |
| `country` | `32EUC_INST:COUNTRY_KNOWLEDGE` | Country Knowledge | ec-europa-finder.primo.exlibrisgroup.com |

Based on [ExLibrisGroup/customModule](https://github.com/ExLibrisGroup/customModule) (Angular 18, Module Federation remote). The original README is in `docs/UPSTREAM-README.md`; how we track upstream is in `docs/UPSTREAM.md`.

## Layout

```
views.config.json            institution + view registry (single source of truth)
scripts/                     use-view / sync-views / build / serve
src/
  assets/                    SHARED assets (every view gets these)
  app/
    shared/
      shared-mappings.ts     selector→component pairs applied to every view
      components/            shared Angular components
      styles/                EC tokens + shared theme scss
    custom1-module/customComponentMappings.ts   fallback only (no-view build)
  views/<key>/
    mappings.ts              shared mappings + this view's own
    theme.scss               compiled to custom.css for this view
    assets/                  overlay: same path as src/assets wins (logo, homepage, ...)
```

How a view build differs from the others (all driven by `angular.json` configurations that
`npm run views:sync` generates from `views.config.json`):

- `fileReplacements`: `customComponentMappings.ts` → `src/views/<key>/mappings.ts`
- `styles`: `src/views/<key>/theme.scss` → `custom.css`
- `assets`: `src/assets` first, then `src/views/<key>/assets` on top

Shared code is imported normally from `src/app/shared`; nothing is copied between views.

## Commands

```bash
npm run setup                    # npm ci with the EC toolchain env (see below)

npm run use -- finder            # set the active view (.active-view, git-ignored)
npm run start:proxy              # dev server for the active view against PROXY_TARGET
npm run start:proxy -- pubs      # ...or name the view explicitly
npm run start                    # no proxy: add ?useLocalCustomPackage=true to the real NDE URL

npm run build                    # active view  -> dist/32EUC_INST-<VIEW_ID>.zip
npm run build -- finder pubs     # specific views
npm run build:all                # all four
npm run build:dev -- finder      # unoptimized + source maps

npm run views:sync               # after editing views.config.json (scaffolds + regenerates angular.json)
```

`NDE_VIEW=<key>` in the environment overrides `.active-view` (useful in CI).

## EC workstation notes

- The endpoint policy blocks executables under the user profile, so esbuild must run from a whitelisted copy: install **Esbuild 0.23.0** from the EC app store (lands in `C:\Program Files\Esbuild.0.23.0`). Several versions coexist there; Angular 18 needs exactly 0.23.0.
- `views.config.json > esbuildBinary` points at it. `npm run setup`, `npm run build` and `npm run start:proxy` set `ESBUILD_BINARY_PATH` from that field automatically, so the machine-wide value (which may point at another version) doesn't matter.
- Use `npm run setup` instead of `npm ci` on a fresh clone (it's `npm ci` with that variable applied).
- Node 22 LTS is the supported line for Angular 18; Node 24 works but warns.

## Dev server

- Open `http://localhost:4201/nde/home?vid=32EUC_INST:<VIEW_ID>&lang=en`.
- `src/assets` and `src/views/<key>/assets` are served live — no rebuild for asset changes.
- Code and SCSS changes are rebuilt by `ng serve`; `custom.css` (the view theme) is only refreshed by `npm run build -- <key>`, because the proxy reads it from `dist/`.
- Behind the corporate proxy: set `HTTPS_PROXY=http://user:password@proxy:port` before `npm run start:proxy`. The dev proxy tunnels through it (untested against the EC proxy — see `proxy/proxy-utils.mjs`).
- The proxy targets the active view's `host` from `views.config.json` (`defaultHost` when a view has none). `PROXY_TARGET=https://...` in the environment overrides it for one run, e.g. to point `ecdata` at ec-europa-finder instead of its alias.

## Adding a component

```bash
ng generate component shared/components/ask-a-librarian --standalone --flat=false
```

Then map it either in `src/app/shared/shared-mappings.ts` (all views) or in one view's `mappings.ts`.
See `src/app/shared/components/ec-notice` for host-component input, NGRX store access and asset paths.
Component styles are capped at 4 kB by `angular.json` budgets — larger styling goes in the view `theme.scss`.

## Adding a view

Add an entry to `views.config.json`, run `npm run views:sync`. That scaffolds `src/views/<key>/` and the build/serve configurations.

## Deploy

Alma → Discovery → View List → edit the view → Manage Customization Package → upload `dist/32EUC_INST-<VIEW_ID>.zip`.
