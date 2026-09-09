# Guest vs signed-in landing page — files to add / change

Drop the `src/` tree of this folder over the repo (same paths), then:

## Delete
- `src/app/shared/home-audience.component.ts` — replaced by `components/ec-session/`

## Changed
- `src/app/shared/auth-state.service.ts` — now wraps the shell's NGRX `user.isLoggedIn`
  (documented; same selector EcNotice already used). No more sessionStorage polling.
- `src/app/shared/shared-mappings.ts` — `nde-search-bar-container-after` now mounts
  `EcSessionComponent`; `EcNoticeComponent` is commented out (one component per slot).
- `src/app/shared/components/ec-notice/ec-notice.component.ts` — uses AuthStateService.
- `src/app/shared/styles/_shared-theme.scss` — adds the `data-ec-audience` show/hide rules
  (global custom.css, so header/footer can use them too).

## Added
- `src/app/shared/components/ec-session/ec-session.component.ts` — headless bridge:
  puts `ec-audience-guest|user` on `<html>` and handles `data-ec-nav` links (keeps vid/lang).
- `src/assets/homepage/homepage_en.html`, `homepage_fr.html`, `homepage.css`
  — one file per language, guest + user blocks in the same file via `data-ec-audience`.
  (The `.tmpl` files can stay; NDE ignores them.)
- `src/assets/header-footer/header.html`, `header_fr.html`, `footer.html`, `footer_fr.html`
  — dummy markup so you can see where NDE renders them.

## Alma side
- Landing Page tab: leave **Enable configuration UNCHECKED** — that is what makes NDE use
  `assets/homepage/homepage_<lang>.html` instead of the structured Links/Welcome/... config.
- Upload the built package (or use `npm run start:proxy -- finder`; the proxy already serves
  `src/assets/homepage/*` locally, see `shouldProxyLandingPageAssetRequest`).

## Verify on Find-eR
1. Guest: `<html>` has `ec-audience-guest`, "Sign in" welcome shows, "My loans" tile hidden.
2. Sign in → class flips to `ec-audience-user` without reload.
3. `?lang=fr` shows homepage_fr / header_fr / footer_fr.
4. Click "My loans": URL becomes `/nde/account?vid=…&lang=…&section=loans`. If the shell
   router rejects the path, adjust `handleNavClick()` — the fallback does a hard navigate.
5. If English header/footer do not appear, also add `header_en.html` / `footer_en.html`
   (docs disagree on the base name).
