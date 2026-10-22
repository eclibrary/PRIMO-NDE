# EC Library — Primo NDE views

Extra features for **Ex Libris Primo NDE** (the "Next Discovery Experience"), made by
the European Commission Library. The repository has two kinds of users:

- **Libraries without a developer** use the ready-made **NOOB kit** (NDE Out Of the Box).
  You don't install anything; everything happens in your browser.
- **Developers** build customization packages for one or more NDE views from this code
  (Angular 18, Module Federation), including the EC Library's own four views.

> Based on Ex Libris' [customModule](https://github.com/ExLibrisGroup/customModule).
> Free to use under the [EUPL-1.2](#licence), provided **"as is"**, without warranty or support.

---

## What it adds to Primo NDE

| Feature | What the visitor sees |
|---|---|
| Pick up where you left off | A link to their last search on the home page, the page they were on, and the last record they opened (marked "last viewed") |
| Loans due soon, account counts | A "loans due soon" line and links with the number of loans, saved records and saved searches on the home page |
| Guest / signed-in / network content | Parts of the home page, header or footer shown only to guests, only to signed-in visitors, or only on the library's own network (with a "Check connection" button) |
| Welcome message | A pop-up message when a view opens, with "don't show me anymore" |
| Notice banners | Coloured message bars on every page, with optional start and end dates |
| Search tips | A box between the search results for searches with certain words |
| Collection badges | A badge (with an info pop-up) on every record of an Alma collection |
| Free versions (Unpaywall) | A "Free version" link on articles when a legal free copy exists (off by default; see the privacy note in the settings) |
| Ask a librarian, LibChat | Question forms and chat filled in with the signed-in visitor's name and e-mail |
| Custom dialogs | Pop-up windows with your own text or an embedded form, opened from any link |
| Opening hours | Today's hours with "Open now / Closed now", or the whole week |
| Scheduled content | Any part of the home page, header or footer shown only between two dates |
| Reading-room PCs (kiosk) | Clears what the previous visitor left behind and resets after inactivity |
| Internal menu links | NDE's own menu links (e.g. "Home") open in the same window instead of a new one |

EC-only features stay out of the NOOB kit: print return label, country scope, resource-sharing format and the EC look.

---

## For libraries: the NOOB kit (no developer needed)

**What you need:** access to your Primo NDE view's configuration in Alma, and a recent
Edge, Chrome or Firefox. No Node, no Git, no command line.

1. **Download the kit**: `ec-nde-noob-<version>.zip` from this repository's
   **Releases** page (right-hand side on GitHub). Unzip it.
2. **Download your package from Alma**: Discovery › View List › your view ›
   *Manage Customization Package* › *Download Package* › *Current View Customization Package*.
   Don't unzip it, and always use a fresh download.
3. **Open `START HERE.html`** from the kit, drop your Alma zip on it, check the settings
   (one section per feature, all in plain language), and click **Make package**.
4. **Upload the new zip in Alma**: same tab › *Upload Package* › *Customization Package*.
   After a few minutes, reload Primo with Ctrl+F5.

The same four steps install the kit, update it to a newer version, or change settings.
Your own files are kept: home page, header, footer, `custom.css`, `custom.js` and images.
If something goes wrong, upload the zip from step 2 again and your view is back as it was.

The kit's `README.txt` has the full instructions. Its `examples/` folder has a commented home page,
header and footer showing every feature. `examples/FOR-CLAUDE.md` is a knowledge file for a Claude
project, so an AI assistant can help you with your HTML and settings.

---

## For developers

### Requirements

- **Node 22 LTS** (Angular 18's supported line; Node 24 works but warns) and npm.
- Git, and an editor (VS Code recommended).
- Access to the Alma view(s) you build for, to upload the packages.

### Quick start

```bash
git clone <this repository>
cd <folder>
npm run setup                 # = npm ci, with the toolchain settings applied (see EC notes below)

npm run use -- finder         # pick the view you work on (stored in .active-view, git-ignored)
npm run start:proxy           # dev server against the live NDE host
#   → open http://localhost:4201/nde/home?vid=32EUC_INST:VU2&lang=en

npm run build                 # → dist/<INST>-<VIEW>.zip, ready to upload in Alma
```

Using it for **your own institution**: change `instId`, `defaultHost` and the `views` in
`views.config.json` (or use `npm run views:add` / `views:remove`). Then review the
settings (`npm run settings`) and replace the EC values: hosts, collection IDs, LibAnswers and
intranet URLs.

### How the repository is organised

```
views.config.json             the views: institution, view IDs, labels, hosts (single source of truth)
config/
  schema.json                 every setting: type, allowed values, help text
  global.json                 settings for all views
  views/<key>.json            per-view overrides (any subset of global.json)
  languages.json              UI languages of the views (en/fr/de)
  noob.json                   neutral defaults for the NOOB kit
data/return-labels.json       return-label addresses per Alma library (EC)
scripts/                      build, serve, scaffolding, settings UI, NOOB build (see Commands)
src/
  bootstrap.ts                page-wide features without Angular (banners, opening hours, kiosk …)
  app/shared/                 code shared by every view
    components/ec-*/          the Angular components (one folder per feature)
    shared-mappings.ts        which component goes in which NDE slot, for every view
    styles/                   shared SCSS (_shared-theme.scss = EC look; _ec-features.scss = feature styles)
    ec-config.generated.ts    GENERATED from config/*.json, don't edit
  assets/                     shipped in every package: settings.js, editor/ (settings editor), homepage, header-footer …
  views/<key>/                one folder per view
    mappings.ts               shared mappings + this view's own components
    theme.scss                compiled to the view's custom.css
    assets/                   overlay: a file here replaces the same path in src/assets
  noob/                       the NOOB kit: core (neutral mappings + styles), starter and example pages, README.txt
docs/                         developer documentation (see below)
dist/                         build output (git-ignored)
```

A view build differs from the others only through `angular.json` configurations that
`npm run views:sync` generates from `views.config.json`:
- `fileReplacements`: the mappings are replaced by `src/views/<key>/mappings.ts`;
- `styles`: `src/views/<key>/theme.scss` becomes `custom.css`;
- `assets`: `src/assets` is copied first, with `src/views/<key>/assets` on top.

### Commands

| Command | What it does |
|---|---|
| `npm run setup` | `npm ci` with the toolchain environment (use it instead of plain `npm ci`) |
| `npm run use -- <key>` | Set the active view (`NDE_VIEW=<key>` in the environment overrides it, e.g. in CI) |
| `npm run start:proxy [-- <key>]` | Dev server proxied against the view's live host. `PROXY_TARGET=https://…` overrides the host for one run |
| `npm run start` | Dev server without proxy: add `?useLocalCustomPackage=true` to the real NDE URL |
| `npm run build [-- <key> …]` | Build the active view, or the named ones → `dist/<INST>-<VIEW>.zip` |
| `npm run build:all` | Build every view |
| `npm run build:dev [-- <key>]` | Unoptimised build with source maps |
| `npm run build:noob` | Build the NOOB kit → `dist/ec-nde-noob-<version>.zip` (plus `-FOR-CLAUDE.md`) |
| `npm run settings` | Local settings UI on http://localhost:4300: every setting, per view, with a Build button |
| `npm run views:add` / `views:remove -- <key>` | Add or remove a view (scaffolds or cleans everything) |
| `npm run views:sync` | After editing `views.config.json` by hand: scaffold missing files, regenerate `angular.json` |
| `npm run component:add` | Create a new component and register it in a slot (interactive) |
| `npm run languages [-- add it "Italiano"]` | List, add or remove UI languages |
| `npm run return-labels` | Regenerate the return-label data (done by every build anyway) |
| `npm run config:generate` | Regenerate `ec-config.generated.ts` (done by every build and serve anyway) |

### Settings

All configurable values are **data, not code**: `config/*.json`, validated against
`config/schema.json` on every build. Edit them in the settings UI (`npm run settings`)
or by hand. Every package also ships `assets/settings.js` and a settings editor
(`assets/editor/index.html`), so settings can be changed **in a deployed package
without rebuilding**. Never put secrets in settings: they ship in the package and
are public. Details: [`docs/SETTINGS.md`](docs/SETTINGS.md).

### Adding things

- **A component**: `npm run component:add`. It asks for name, scope (shared or one view),
  NDE slot and kind, then writes the files and the mapping.
- **A setting**: add it to `config/schema.json`, give it a value in `config/global.json`,
  and add a neutral value in `config/noob.json` if it has an EC value
  (see "Adding a setting" in `docs/SETTINGS.md`).
- **A view**: `npm run views:add`.
- **A feature that should also be in the NOOB kit**: see "Keep in step" in [`docs/NOOB.md`](docs/NOOB.md).

### Dev server notes

- `src/assets` and `src/views/<key>/assets` are served live: asset changes need no rebuild.
- Code and SCSS changes are rebuilt by `ng serve`. The view theme (`custom.css`) is only
  refreshed by `npm run build -- <key>`, because the proxy reads it from `dist/`.
- Behind a corporate proxy, put `HTTPS_PROXY=http://<user>:<password>@<proxy>:<port>` in
  a `.env` file at the repo root (git-ignored); the dev proxy tunnels through it.

### Deploy

Alma › Discovery › View List › edit the view › *Manage Customization Package* ›
*Upload Package* › upload `dist/<INST>-<VIEW>.zip`. Primo shows it after a few minutes.

### Documentation

| File | About |
|---|---|
| [`docs/SETTINGS.md`](docs/SETTINGS.md) | Every feature's settings, the settings flow, settings.js and the editors |
| [`docs/NOOB.md`](docs/NOOB.md) | How the NOOB kit is built, what it contains, what to keep in step |
| [`docs/UPSTREAM.md`](docs/UPSTREAM.md) | How Ex Libris' customModule is tracked (`[nde-views]` markers) |
| [`docs/UPSTREAM-README.md`](docs/UPSTREAM-README.md) | Ex Libris' original README |
| `src/views/<key>/README.md` | Notes per view |

The code is commented for future developers: each file starts with what it does, why,
and which NDE markup it relies on.

### EC workstation notes

- The endpoint policy blocks executables under the user profile, so esbuild must run from
  a whitelisted copy: install **Esbuild 0.23.0** from the EC app store (it lands in
  `C:\Program Files\Esbuild.0.23.0`). Angular 18 needs exactly 0.23.0.
- `views.config.json › esbuildBinary` points at it. `npm run setup`, `build` and
  `start:proxy` set `ESBUILD_BINARY_PATH` from that field, so a different machine-wide
  value doesn't matter. Off EC machines this field is ignored.
- On the EC network, set the corporate proxy in `.env` (see `scripts/serve.cjs` for the
  format, and URL-encode special characters in the password).

---

## Licence

Copyright © European Union, 2026.

Licensed under the **European Union Public Licence (EUPL) v1.2**, see [`LICENSE`](LICENSE).
The EUPL is an open-source licence: you may use, change and share this code, including in
your own projects. If you distribute a changed version, you must share its source under
the EUPL or a compatible licence (listed in the appendix of `LICENSE`, e.g. GPL v3).
The software is provided **"as is"**, without any warranty (Articles 7 and 8 of the licence).

Parts are based on Ex Libris' [customModule](https://github.com/ExLibrisGroup/customModule),
© 2024 Ex Libris, Ltd., under the BSD 3-Clause licence: see
[`LICENSES/ExLibris-BSD-3-Clause.txt`](LICENSES/ExLibris-BSD-3-Clause.txt).
"Ex Libris", "Alma" and "Primo" are trademarks of their owners. This project is not
affiliated with or endorsed by Ex Libris.
