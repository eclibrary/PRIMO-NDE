# Settings

All configurable values of the custom module are **data**, not code:

| File | Holds |
|---|---|
| `config/schema.json` | What exists: every setting, its type, allowed values and help text |
| `config/global.json` | Values for all views |
| `config/views/<view>.json` | Overrides for one view — any subset of the same keys |
| `data/return-labels.json` | Return-label addresses per Alma library code (Find-eR) |
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

## Library on the Go

Section `libraryOnTheGo` — badge on records of the Library on the Go collection
(`src/app/shared/components/ec-library-on-the-go/`), shown at the end of the record's top line with
an (i) button that opens an explanation. Set the **Collection ID** (the number after `$$D` in the
record's PNX field `control.colldiscovery`), the badge text and colour, and the dialog title and
text (HTML). Untick *Show the badge* on a view tab to switch it off for that view.

## No results help

Section `noResultsHelp` — block under NDE's "No records found" message
(`src/app/shared/components/ec-no-results-help/`). Title and text (HTML) per language; a link to the
Ask-a-librarian page opens the modal.

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
`src/views/finder/assets/return-label/label.js` (missing languages show English).
Rebuild the views after any change: the list reaches the bundle as
`EC_LANGUAGES` in the generated config.

## The settings UI

    npm run settings          # http://localhost:4300, opens in the browser

Local only (binds to 127.0.0.1); no login — anyone with the repo can use it. It edits the files
above through forms generated from `schema.json`:

| Tab | Edits |
|---|---|
| Global | `config/global.json` |
| one per view | `config/views/<key>.json` — shows merged values; greyed fields are inherited from Global. "Override for this view" / "Use global" toggle an override. Only overrides are written. |
| Return labels | `data/return-labels.json` (also regenerates the package file) |
| Views | `views.config.json`: institution, default host, and the views (id, label, host). "+ Add view" then Save scaffolds the view. "Build" runs `npm run build -- <view>` and shows the output and the zip to upload. |

Saving runs the same validation as the build; invalid input is refused with the path of the
problem. Saved changes reach Primo only after a build and a package upload in Alma — the UI
reminds you of that.
