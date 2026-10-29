// src/app/shared/core-styles.ts
//
// NOOB ZIP ONLY: load our global stylesheet, assets/core/ec-core.css.
//
// WHY: in the EC views our global styles ARE the package's custom.css (built
// from src/views/<view>/theme.scss). In the noob zip, custom.css belongs to the
// institution — the package maker keeps theirs on every install and update —
// so our functional styles ship separately (src/noob/core/theme.scss →
// assets/core/ec-core.css, see scripts/build-noob.cjs) and this file adds them
// to the page.
//
// ORDER: the <link> goes right BEFORE the institution's custom.css when that
// is already in the page, so for rules of equal weight theirs win (they can
// restyle our badges, dialogs, colours). Otherwise it is appended to <head>.
//
// Called from bootstrapRemoteApp (src/bootstrap.ts); a no-op in EC view builds.
import { EC_CONFIG_VIEW } from './ec-config.generated';

/** Package root at runtime (…/nde/custom/<INST>-<VIEW>/), set by module federation. */
declare const __webpack_public_path__: string;

/** Marker so a second call (or a re-bootstrap) never adds the sheet twice. */
const LINK_ID = 'ec-core-css';

export function loadCoreStyles(): void {
  // Widened to string: the generated constant is a literal type per build
  // ("finder", "noob" …), which would make this comparison a compile error.
  const build: string = EC_CONFIG_VIEW;
  if (build !== 'noob') return; // EC views: styles are in custom.css already
  if (document.getElementById(LINK_ID)) return;
  const base = typeof __webpack_public_path__ === 'string' ? __webpack_public_path__ : '';
  if (!base) return; // package location unknown — nothing sensible to load

  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  // Keep the literal "assets/core/ec-core.css": scripts/build-noob.cjs finds it in
  // the compiled code and appends ?v=<kit version> (cache-busting on kit updates).
  link.href = `${base.endsWith('/') ? base : base + '/'}assets/core/ec-core.css`;

  // The institution's custom.css from THIS package, if NDE has added it already.
  const theirs = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .find((l) => /\/custom\.css(\?|$)/.test(l.href) && l.href.startsWith(new URL(base, location.href).href));
  if (theirs?.parentNode) theirs.parentNode.insertBefore(link, theirs);
  else document.head.appendChild(link);
}
