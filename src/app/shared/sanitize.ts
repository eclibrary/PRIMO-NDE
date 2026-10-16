// src/app/shared/sanitize.ts
//
// HTML SANITISER for texts from the settings that are shown WITHOUT Angular
// (notice banners — notice-banners.ts, opening-hours notes — opening-hours.ts).
// Angular components get this for free from [innerHTML]; plain DOM code does
// not, so it uses sanitizeHtml() before every innerHTML.
//
// WHY AT ALL: settings.js is edited by library staff, not visitors, so this is
// not about attackers typing into a form. It is a safety net: a pasted snippet
// with a <script>, an onclick or a javascript: link must not run inside Primo.
//
// HOW: allow-list. The HTML is parsed into an inert document (DOMParser: no
// scripts run, no images load), then rebuilt:
//   - allowed tags (ALLOWED_TAGS) are kept with their allowed attributes;
//   - any other tag is dropped but its TEXT is kept (e.g. <font> → its text);
//   - dangerous containers (DROP_WITH_CONTENT: script, style, iframe, …) go
//     entirely, text included;
//   - href only with http(s):, mailto:, tel:, a relative path or #anchor.
// Links that open a new tab get rel="noopener".
//
// What the WYSIWYG editor of the settings (src/assets/editor/rich-text.js)
// produces — paragraphs, bold, italic, lists, links, headings — all passes.

/** Tags kept as they are (attributes still filtered). */
const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'mark', 'code', 'br', 'span',
  'p', 'div', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr',
]);

/** Tags removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'textarea', 'select', 'button',
]);

/** Attributes kept on any allowed tag (href/target/rel are handled for <a>). */
const ALLOWED_ATTRS = new Set(['class', 'title', 'aria-label', 'lang', 'dir']);

/** href values that are allowed: web, mail, phone, relative and in-page links. */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|\.{0,2}\/|#|[^:]*$)/i;

/** Sanitised copy of `html` (a string), safe for element.innerHTML. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.createElement('div');
  copyChildren(doc.body, out);
  return out.innerHTML;
}

/** Rebuild `from`'s children into `to`, keeping only what is allowed. */
function copyChildren(from: Node, to: Node): void {
  from.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      to.appendChild(document.createTextNode(node.textContent ?? ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return; // comments etc.
    const src = node as Element;
    const tag = src.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return;
    if (!ALLOWED_TAGS.has(tag)) {
      copyChildren(src, to); // unknown wrapper: keep the text, lose the tag
      return;
    }
    const el = document.createElement(tag);
    for (const attr of Array.from(src.attributes)) {
      const name = attr.name.toLowerCase();
      if (ALLOWED_ATTRS.has(name)) el.setAttribute(name, attr.value);
    }
    if (tag === 'a') {
      const href = (src.getAttribute('href') ?? '').trim();
      if (href && SAFE_HREF.test(href)) el.setAttribute('href', href);
      if (src.getAttribute('target') === '_blank') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    }
    copyChildren(src, el);
    to.appendChild(el);
  });
}
