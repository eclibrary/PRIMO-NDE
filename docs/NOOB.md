# NOOB — NDE Out Of the Box

The "noob zip": a kit that lets any library with a Primo NDE view install our features
**without a developer**: no Node, npm, Git or build. Built from this repo with

    npm run build:noob          (or: npm run build -- --noob)

Output: `dist/ec-nde-noob-<version>.zip` (version = build date and time, e.g.
`2026.10.15-1432`). That zip is what you hand out.

## What the library does

1. Downloads their view's customization package from Alma.
2. Unzips the kit, opens **START HERE.html**, drops the Alma zip on it.
3. Checks the settings, clicks **Make package**.
4. Uploads the new zip in Alma.

The same four steps install the kit, update it to a newer version, or change
settings. Always from a **fresh** download: the maker shows when the zip was
downloaded and the newest file date in it, and warns when the zip is more than a day old
(`staleWarning()` in `src/assets/editor/index.html`) — an old zip would undo later changes in Alma. The instructions are in the page and in the kit's `README.txt`
(source: `src/noob/README.txt`).

## What is in the kit

| File | What |
|---|---|
| `START HERE.html` | `src/assets/editor/index.html` in *maker mode* (its `<!-- ec:scripts -->` block swapped for the three scripts below) |
| `maker/kit.js` | `window.EC_KIT`: version, schema, neutral default settings, the core files (base64), the rule for which package files are ours |
| `maker/zip.js` | zip reader/writer, no library (`src/assets/editor/zip.js`) |
| `maker/rich-text.js` | the WYSIWYG for HTML messages |
| `examples/header.html`, `examples/footer.html` | example header bar and footer band using the kit's `.ec-header` / `.ec-footer` styles (go in the library's `assets/header-footer/`) |
| `examples/homepage_en.html` | example home page for the library's own package: guest/user and network parts, `data-ec-nav` links, "pick up where you left off", loans due, account counts, kiosk content, custom dialogs, opening hours, scheduled content — commented for non-developers (`src/noob/examples/`, copied as is) |
| `maker/kit.js` → `starter` | starter home page, header and footer (`src/noob/starter/`): the maker offers to ADD the kinds a package lacks (ticked by default only when all three are missing); never replaces the library's own. `STARTER_FILES` in `scripts/build-noob.cjs`, `starterPanel()` in the editor |
| `examples/FOR-CLAUDE.md` | knowledge file for a Claude project: instructions for Claude (how the kit works, what to edit and what never, HTML rules, how to answer) + README + every setting with its default + the examples. Template `src/noob/FOR-CLAUDE.md`, filled by `forClaude()` in `scripts/build-noob.cjs`; a copy lands in `dist/ec-nde-noob-<version>-FOR-CLAUDE.md`. The build fails if it contains an EC string |

`kit.js` carries the core as data because a page opened from disk (`file://`)
cannot read the files next to it, but it can load a `<script>`.

## Core vs. the library's own files

The **core** (replaced as a whole on every install/update) is the compiled
module: `remoteEntry.js` and the other `.js`/`.css` files at the top of the
package folder (except `custom.css`), plus `assets/core/` (`ec-core.css` = our
global styles, `version.js` = "the kit is installed, version X"). The maker
removes those paths before adding the new core, so old hashed chunks never pile
up (`KIT.coreRule`, defined in `scripts/build-noob.cjs`).

Everything else is the library's and is kept untouched: the template's
`assets/css/custom.css` (their styles) and `assets/js/custom.js` (their small
scripts) — NDE loads both on every page (verified Oct 2026; a `custom.css` at the
package top is loaded too) — homepage, header/footer, images, and
`assets/settings.js` (merged: kit defaults + their values; settings that are new
in this kit version are tagged "new" in the form; obsolete ones are dropped).
When a package has no stylesheet at all, the maker adds a starter
`assets/css/custom.css` with a comment.

Our global styles are NOT in `custom.css` (that file is theirs). The module adds
`assets/core/ec-core.css` itself, right before their first `custom.css`, so their
rules win (`src/app/shared/core-styles.ts`; a no-op in the EC view builds).

**Another custom module:** a package with `remoteEntry.js` but without
`assets/core/version.js` was made by someone else (developer, vendor, or the Ex
Libris template). The maker shows a warning and only proceeds after the library
ticks "Replace it".

**Never use the maker on a view built from this repository** (the EC views:
Find-eR, Publications, EC Data, Country Knowledge). Their packages carry no
`assets/core/version.js` either, so the maker shows the same warning — and if
"Replace it" is ticked, it swaps their program for the kit's and silently drops
the features the kit leaves out (print return label, resource-sharing format,
country scope) and the settings it does not know. To change the settings of
those views without a developer, use **the view's own settings editor**
(`assets/editor/index.html` in its package): drop the Alma zip, change, "Make
package" — it replaces only `assets/settings.js` (see "Settings in the package"
in `docs/SETTINGS.md`). The editor in turn refuses packages made with the kit.

## Nothing EC-specific

| Where | How |
|---|---|
| Settings | `config/global.json` + `config/noob.json` (EC hosts, ids, URLs and wording blanked; EC-only features off) |
| Mappings | `src/noob/core/mappings.ts` + `noob-root.component.ts`: no resource-sharing format rule, no return labels, no country scope chip/links |
| Styles | `src/noob/core/theme.scss`: functional rules only — no EC header/footer/logo/tweaks |
| Assets | none: the build deletes `dist/noob-build/assets` before adding `assets/core/` |
| Check | the build FAILS if the core contains `NO_EC_STRINGS` (`32EUC_INST`, `ec.europa.eu`, `intragate`, the Library on the Go collection id …) |

Keep in step:
- a new generic feature in `EcSharedRootComponent` → also in `src/noob/core/noob-root.component.ts`;
- a new functional global style in `_shared-theme.scss` → also in `src/noob/core/theme.scss`;
- a change to the home page block styles in `src/views/finder/assets/homepage/homepage.css`
  (welcome, loans due, account counts) → also in the HOME PAGE BLOCKS part of `src/noob/core/theme.scss`;
- a new home page feature → an example in `src/noob/examples/homepage_en.html`;
- a page-wide feature without Angular (notice banners, opening hours, scheduled content, kiosk)
  is started in `src/bootstrap.ts`, which both builds share — nothing to add for the noob zip;
  its styles go in `styles/_ec-features.scss`, which both `_shared-theme.scss` and
  `src/noob/core/theme.scss` load;
- a new setting with an EC value in `global.json` → a neutral value in `config/noob.json`
  (the `NO_EC_STRINGS` check catches hosts and ids, not wording);
- a feature that should not be offered → `HIDDEN_SECTIONS` in `scripts/build-noob.cjs`.

**Colours follow the Alma colour theme.** Alma's Color Theme is a stylesheet
NDE loads (`/nde/assets/color-themes/custom-color-theme-<name>.css`) that sets
Material M3 tokens on `<html>` (`--sys-primary`, `--sys-on-primary`,
`--sys-primary-container`, …). Our styles only use `--ec-blue`,
`--ec-on-blue`, `--ec-blue-soft`, `--ec-on-blue-soft` and `--ec-focus`;
`src/noob/core/theme.scss` maps them onto the theme tokens, with the EC
colours as fallback. The EC views keep EC blue: `_shared-theme.scss` pins
`--ec-blue`, and the others fall back to the EC values (white text, yellow
focus ring). New styles: use these variables, never fixed colours.

**Languages:** the noob zip starts in English only (`NOOB_LANGUAGES` in
`scripts/config-generate.cjs`): the defaults keep only the English texts and the
compiled language list is `['en']`. Libraries add their languages in the
maker's Languages section; texts left empty there show the English text.

`config/noob.json` follows the language list like the other settings files
(`npm run languages` edits it too). The `noob` build configuration in
`angular.json` is written by `build-noob.cjs` and kept by `views:sync`; `noob`
is a reserved key, not a view.
