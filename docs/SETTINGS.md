# Settings

All configurable values of the custom module are **data**, not code:

| File | Holds |
|---|---|
| `config/schema.json` | What exists: every setting, its type, allowed values and help text |
| `config/global.json` | Values for all views |
| `config/views/<view>.json` | Overrides for one view — any subset of the same keys |
| `data/return-labels.json` | Return-label addresses per Alma library code (all views; also in each package's settings.js) |
| `views.config.json` | The views themselves: id, label, host |

## How values reach the code

`prebuild.js` (run by every build/serve) calls `scripts/config-generate.cjs`, which deep-merges
`global.json` with the view's file (objects merge; arrays and scalars in the view file replace),
validates the result against `schema.json`, and writes `src/app/shared/ec-config.generated.ts`.
`src/app/shared/ec-config.ts` re-exports that as `EC_CONFIG`. Components read `EC_CONFIG.<section>.<key>`.

Because each view is its own build, `EC_CONFIG` already holds the merged values for that view — no
runtime lookup of "which view am I".

A validation error (wrong type, unknown key, missing required) **aborts the build** with the path of
the problem. This is deliberate.

## Editing

- By hand: edit the JSON, rebuild. Editors that understand `$schema` (VS Code) give completion and
  inline help from `schema.json`.
- With the UI: `npm run settings` (see below).
- `npm run config:generate -- <view>` regenerates the TypeScript without building (useful after a
  fresh clone, so the editor stops complaining about the missing generated file).

## Adding a setting

1. Add it to `config/schema.json` with a `title` and `description` (the UI renders from these).
2. Add it to the `EcConfigValues` interface in `src/app/shared/ec-config.ts` (the generated file is
   typed against it, so the build fails if the two drift apart).
3. Put the default in `config/global.json`.
4. Read it in code as `EC_CONFIG.section.key`.

Presentation hints: `title`/`description` written next to a `$ref` are used by the UI, and
`"format": "html"` on a localised entry (see `welcomeMessage.html`) renders a large textarea per
language instead of one-line inputs.

## Welcome message

Section `welcomeMessage` — the modal shown when a patron opens a view
(`src/app/shared/components/ec-welcome-message/`).

| Want | Do |
|---|---|
| One message for all views | Global tab: tick *Show the message*, fill in *Title* and *Message (HTML)* |
| A different message on one view | That view's tab: *Override for this view* on *Title* / *Message (HTML)* |
| No message on one view | That view's tab: override *Show the message* and untick it |
| No message anywhere | Global tab: untick *Show the message* |

Closing the modal hides it for the rest of the browser tab's session; ticking *Don't show this
message again* hides it for `rememberDays` (180 ≈ 6 months). **Any change to the title or text is a
new message** and is shown to everyone again — there is no id to bump. The HTML is sanitised on
display: scripts, inline `style` and `data-*` attributes are removed; use `class` for styling.

## Collection badges (Library on the Go)

Section `libraryOnTheGo` (key kept from the one-badge days) — badges on records of Alma
collections, at the end of the record's top line, each with an (i) button that opens an
explanation (`src/app/shared/components/ec-library-on-the-go/`). `badges` is a **list**: one entry
per collection with its **Collection ID** (the number after `$$D` in the record's PNX field
`control.colldiscovery`), text, colour (colour picker; empty = theme colour), and dialog title and
text (HTML; empty = no (i)). A record in two collections gets both badges. The EC view has one
badge, Library on the Go; `{lotgCollectionId}` in home-page links is the id of the **first** badge.

Until Oct 2026 the section held one badge directly (`collectionId`, `label`, `color`, …,
`pnxEndpoint`). Older settings.js files are converted to `badges[0]` wherever they are read:
`migrateLegacySettings()` in `src/app/shared/runtime-settings.ts` (Primo), in
`src/assets/editor/index.html` (package editor and maker) and in `scripts/settings-ui/server.cjs`
(Import settings.js). `pnxEndpoint` is a constant now (`src/app/shared/record-doc.ts`).

The badges share the record's top line with the **free version link** (below):
`EcRecordLineComponent` (`ec-record-line/`) sits on the NDE slot, finds the record once and places
both.

## Free versions (Unpaywall)

Section `openAccess` — off by default. On records with a DOI it asks
[Unpaywall](https://unpaywall.org) for a legal free copy and adds a "Free version (author
manuscript)" link (`src/app/shared/components/ec-open-access/`). Needs a contact **e-mail**
(Unpaywall's rule); **Only when you have no online access** skips records whose
`delivery.availability` starts with `fulltext`. The request goes from the visitor's browser to
`api.unpaywall.org` (DOI + IP address, no patron data) — the reason it is off by default and why a
library switching it on should mention it in its privacy notice. Answers are kept per DOI in
sessionStorage (`ec:oa:`).

## Notice banners

Section `noticeBanners` — coloured message bars on every page (`src/app/shared/notice-banners.ts`,
plain DOM started from `src/bootstrap.ts`, styles in `styles/_ec-features.scss`). A list; each
banner has text (HTML per language, sanitised by `sanitize.ts`), **position** (`top` = above the
menu, `belowMenu`, `belowSearch` = under the search area or else under the menu, `bottom` = fixed
to the bottom of the window), **style** (`theme`, `info`, `warning`, `success`, `custom` + a colour
from the colour picker; text colour black/white is chosen for contrast by `colour.ts`), optional
**from / until** dates (`YYYY-MM-DD`, until included) and **can be closed** (remembered per
browser in `ec:notice:<fingerprint>`; editing the banner shows it again; sessionStorage on kiosk PCs).

NDE has no slot for "under the menu": the code finds the top bar from NDE's main menu
(`[data-qa="main-menu_links"]`) — see the header of `notice-banners.ts`. On a new NDE release, run
`ecNoticeBanners.probe()` in the browser console to see what it found.

## Opening hours

Section `openingHours` (`src/app/shared/opening-hours.ts`, plain DOM). Weekly hours per day
(`09:00-17:00`, or `09:00-12:30, 13:30-17:00`; empty = closed) plus a list of **exceptions**
(`from`, `until`, `hours`, `note`) that replace the weekday's hours on those dates. **Time zone**
(advanced, e.g. `Europe/Brussels`) makes "Open now" right for visitors abroad. In the library's HTML:

| Markup | Shows |
|---|---|
| `<p data-ec-opening-hours></p>` | Today: 09:00–17:00 [Open now] All opening hours |
| `<div data-ec-opening-hours="week"></div>` | the week table + coming exceptions |
| `<a href="#ec-opening-hours">…</a>` | opens a pop-up with the week |

Placeholders stay hidden until filled (`_ec-conditional.scss`), so nothing shows while the feature is off.

## Scheduled content

No settings: `data-ec-from="YYYY-MM-DD"` and/or `data-ec-until="YYYY-MM-DD"` (time optional:
`2026-12-20T14:00`) on any element of the home page, header or footer shows it only between those
dates (`src/app/shared/scheduled-content.ts`; hidden until checked, rule in `_ec-conditional.scss`).
Not inside texts from the settings — those are sanitised and lose `data-*` attributes.

## Loans due soon

Section `loansDue` — line on the landing page for signed-in patrons
(`src/app/shared/components/ec-loans-due/`), e.g. "Overdue loans: 1 · Loans due within 7 days: 2".
It fills the `data-ec-loans-due` markup in the landing page HTML and is hidden when there is nothing
to report. **TEST ONLY: use past loans** shows past loans as overdue so the line can be checked
without an active loan — never leave it ticked in production.

Never put secrets here — these files ship in the customization package.

## Languages

The UI languages of all views live in `config/languages.json` (English first —
it is the fallback whenever a translation is missing, and cannot be removed).
Change them in the settings UI (**Languages** tab) or on the command line:

    npm run languages                       # list
    npm run languages -- add it "Italiano"  # add (creates starter files, see below)
    npm run languages -- remove it          # remove (lists what goes, asks first)
    # --dry-run: show only · --yes: no question

**Adding** a language updates `config/schema.json`, so every translatable text
in the settings gets a field for it (empty = English is shown), and creates
`homepage_<code>.html` next to every `homepage_en.html` plus
`header_<code>.html` / `footer_<code>.html` — copies of the English files marked
"TODO: translate". Existing files are never overwritten.

**Removing** a language deletes its translations from `config/global.json` and
`config/views/*.json`, resets `defaultLang` to `en` where needed, and deletes its
homepage/header/footer files. The settings UI shows the full list before saving.

By hand, after adding: enable the language for each view in **Alma** (NDE only
offers languages enabled there), translate the starter HTML files, and — if the
return-label page should be translated too — add an entry to the text table in
`src/assets/return-label/label.js` (missing languages show English).
Rebuild the views after any change: the list reaches the bundle as
`EC_LANGUAGES` in the generated config.

## Settings in the package (settings.js) and the settings editor

Every build also puts the view's settings **into the package** as
`assets/settings.js`, plus a **settings editor** at `assets/editor/index.html`.
When a page opens, the custom module reads `settings.js` and its values override
the ones built into the package (`src/app/shared/runtime-settings.ts`). So
settings can be changed **without a build**:

1. Open `https://<primo host>/nde/custom/<INST>-<VIEW>/assets/editor/index.html`
   (or `assets/editor/index.html` in an unzipped package, offline).
2. Change texts, links and switches. HTML messages have a small WYSIWYG editor
   (`assets/editor/rich-text.js`, also used by `npm run settings`); technical
   fields appear with "Show advanced settings" (`"x-advanced": true` in
   `config/schema.json`).
3. **Download settings.js**, put it in the package as `assets/settings.js`, zip
   the `<INST>-<VIEW>` folder again and upload it in Alma.

Safety: the module reads the file as data (never executes it), ignores a file
made for another view, ignores values of the wrong type and settings it does not
know, and falls back to the built-in values if the file is missing or broken.
The console line `[ec] settings: …` says what happened.

**One place per view.** A build writes `settings.js` from `config/*.json`, so it
replaces whatever was edited live. For a view edited in the package editor, first
use **Import settings.js…** on that view's tab in `npm run settings` (with the
file downloaded from the live package), then build. Return addresses edited in
the package editor are imported too, into `data/return-labels.json` (shared by
all views); settings that no longer exist (file from an older package) are
skipped and listed.

**Languages.** The editor's Languages panel is authoritative for the package: a
language added there is accepted (`lang=it` shows the Italian texts), a language
removed there falls back to English, whatever the package was built with.

**Return labels.** `settings.js` also carries the return addresses per Alma
library code (`"libraries"`, from `data/return-labels.json`), editable in the
editor under *Return labels* (right after *Print return label*). The label page
(`assets/return-label/`) reads them from `settings.js` and falls back to
`assets/data/libraries.js` (the built-in copy) when it cannot.

## Custom dialogs

Section `customDialogs` — the library's own pop-up dialogs
(`src/app/shared/components/ec-custom-dialogs/`). `dialogs` is a list (Add / Remove in all three
editors); each dialog has `selector` ("Opens from"), a `title` and an `html` text per language
(WYSIWYG), and optionally `widget`.

**Opens from** (`selector`) is read in one of two ways:
- a **plain word** (letters, digits, `-`, `_`, starting with a letter), e.g. `dialog-borrowing`:
  a link whose `href` is exactly `#dialog-borrowing`, or any element with the class
  `dialog-borrowing`, opens it — the easy way for a library's own HTML. A plain word is never read
  as a tag name.
- **anything else** is a CSS selector, e.g. `a[href*="calendly.com"]` — for elements the library
  cannot edit (NDE's menu links). Checked by the editors; at runtime an invalid one skips the
  dialog with a console warning.

Two dialogs with the same "Opens from" are flagged by the editors (at runtime the first one wins).
Not for Ask a librarian links: that feature keeps its own trigger and prefill. Until Oct 2026 the
plain-word trigger was a separate `name`; older settings are converted (`migrateLegacySettings`).
Text is sanitised by Angular (no scripts or inline styles).

**Widget code** (`widget`) — embed code of a third-party widget (divs + scripts), shown below the
text and started on the first opening; scripts are re-created so they run, in order, at their
place in the code. NOT sanitised — the one place where settings.js puts code into Primo (no new
risk: whoever can edit settings.js can upload the package). Embed codes using `document.write`
cannot work. The dialog is wider (48rem) when it has a widget.

## Conditional content (home page, header, footer)

Attributes on any element in the static HTML; the module puts the deciding
classes on `<html>`:

| Attribute | Shown when | Classes (decided by) |
|---|---|---|
| `data-ec-audience="guest"` / `"user"` | not signed in / signed in | `ec-audience-guest` / `ec-audience-user` (EcSessionComponent) |
| `data-ec-last-search` | a last search is stored | `ec-has-last-search` / `ec-no-last-search` (EcLastSearchComponent) |
| `data-ec-kiosk="only"` / `"hide"` | only on / not on reading room PCs | `ec-kiosk` / `ec-no-kiosk` (kiosk.ts) |
| `data-ec-network="ec"` / `"external"` | on / outside the EC network | `ec-network-ec` / `ec-network-external` (NetworkService) |

**No jumping content:** conditional content is hidden until one of its two
classes is on `<html>` (`src/app/shared/styles/_ec-conditional.scss`, one
"hide unless" rule per variant); it then
appears once, never as a default that gets replaced. What can be known without
Angular (kiosk mode, a cached or switched-off network check) is set before
Angular starts (`src/app/shared/early-classes.ts`). Caveat: audience and last
search come from the shared root on the search-bar slot, so audience-gated
header/footer content stays hidden on pages without a search bar.

## Print return label

A "Print return label" link under each loan in the library card, opening a
printable label with the return address of the loan's library
(`assets/return-label/index.html?librarycode=BCB&userlocation=BRU&lang=en` — the
same page is linked from library e-mails, so keep that URL stable).

| Setting | Where | Meaning |
|---|---|---|
| `printReturnLabel.enabled` ("Activate") | `global.json` = off; `views/finder.json` = on | Show the link in this view |
| `printReturnLabel.showOnPastLoans` | `global.json` = off; Find-eR = on | Also on returned loans (CSS class `ec-print-return-label--returned`) |
| `printReturnLabel.label` | `global.json` | Link text per language |

The component (`src/app/shared/components/ec-print-return-label/`) is mounted in
every view (`shared-mappings.ts`, slot `nde-loan-item-after`) and does nothing
unless activated. The technical details — label page path, where NDE keeps the
library code (`CODE_PATHS`), how a returned loan is recognised
(`RETURNED_MARKER`) — are constants at the top of that component, not settings.
If the link disappears after an NDE release, the console shows
`[ec] print-return-label: no library code found…` with the object to look in.

## The settings UI

    npm run settings          # http://localhost:4300, opens in the browser

Local only (binds to 127.0.0.1); no login — anyone with the repo can use it. It edits the files
above through forms generated from `schema.json`:

| Tab | Edits |
|---|---|
| Global | `config/global.json` |
| one per view | `config/views/<key>.json` — shows merged values; greyed fields are inherited from Global. "Override for this view" / "Use global" toggle an override. Only overrides are written. |
| Return labels | `data/return-labels.json` — addresses for every view (also regenerates the package file) |
| Views | `views.config.json`: institution, default host, and the views (id, label, host). "+ Add view" then Save scaffolds the view. "Build" runs `npm run build -- <view>` and shows the output and the zip to upload. |

Saving runs the same validation as the build; invalid input is refused with the path of the
problem. Saved changes reach Primo only after a build and a package upload in Alma — the UI
reminds you of that.
