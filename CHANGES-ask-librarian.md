# Ask-a-librarian modal (LibAnswers widget + Europa prefill helper) — files to add / change

Supersedes the earlier iframe version. Drop `src/` over the repo root (merge), replace when asked.

## Added
- `src/app/shared/ec-config.ts` — shared config: trigger URL prefixes, Europa helper script URL,
  LibAnswers host + widget id per language, prefill field mapping, labels, and the user-info
  endpoint + response mapping. **Four TODOs to fill in** (marked in the file).
- `src/app/shared/user-info.service.ts` — fetches the signed-in patron's details from Primo
  (Bearer JWT, same as the shell). Guests → null. Cached until sign-in state changes.
- `src/app/shared/components/ec-ask-librarian/` (.ts/.html/.scss) — the modal: loads
  libanswers.script.js, then the widget script, renders the form in-DOM, calls
  `LibAnswersFormFill.fill({name, email, …})`.
- `src/app/shared/components/ec-shared-root/ec-shared-root.component.ts` — hosts
  EcSessionComponent + EcAskLibrarianComponent in the single shared slot.

## Changed
- `src/app/shared/shared-mappings.ts` — slot now mounts EcSharedRootComponent.
- `src/assets/homepage/homepage_en.html` / `homepage_fr.html` — "Ask a librarian" links point at
  `https://ec.europa.eu/libraries/pages/askalibrarian/en/` (resp. `/fr/`) so they trigger the modal.

## Fill in before testing (ec-config.ts)
1. `askALibrarian.formfillScriptUrl` — where libanswers.script.js is hosted on Europa
   (libanswers.style.css must sit next to it; the script resolves it relatively).
2. `askALibrarian.widgetId` — the LibAnswers question-form widget id(s) (`8158` in the script's comments).
3. `userInfo.endpoint` + `mapResponse` — on Find-eR, signed in, open My Account > Personal details
   with DevTools > Network and copy the request the shell makes to `/primaws/rest/priv/...`;
   adjust the path and the field names in `mapResponse` to the actual response.
4. `askALibrarian.prefillFromUser` — the `name` attributes of the LibAnswers form fields
   (inspect the rendered form; the shadow root is forced open by the helper).

## Verify
1. Click "Ask a librarian" → modal, "Loading the form…", then the LibAnswers form. Esc / backdrop / ×
   close it; focus returns to the link. Second open is instant.
2. Signed in → name and e-mail prefilled. Guest → empty form.
3. Ctrl-click / middle-click → real Europa page in a new tab.
4. `?lang=fr` → French title; French widget if a different id is configured.
5. Console: no CSP errors for ec.europa.eu / *.libanswers.com. If the Primo host's CSP blocks external
   scripts, the modal shows the error state with the fallback link — then this approach needs
   rethinking (iframe of the Europa page).

## Known trade-offs
- libanswers.script.js patches `Element.prototype.attachShadow` globally (forces `mode: 'open'`).
  NDE/Angular Material use emulated encapsulation, so this should be harmless; watch for
  regressions in any component that relies on closed shadow roots.
- The widget DOM is kept between opens. After a question is submitted, the next open shows the
  widget's "thank you" state until the page is reloaded. If that matters, remove the container
  and re-inject the widget script on each open (see `loadedWidgets`).
