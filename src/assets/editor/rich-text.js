/*
  rich-text.js — a small WYSIWYG editor for the HTML message settings
  (welcome message, Library on the Go explanation, …).

  Used by BOTH editors:
    - the settings editor in every package   (assets/editor/index.html)
    - the local settings UI (npm run settings), which serves this same file
      from src/assets/editor/ — one implementation, identical behaviour.

  Why our own and not a library: the package editor must work offline and from
  file:// (no CDN), and every package carries it, so it must stay tiny. The
  messages only need a handful of formats.

  WHAT IT ALLOWS — and nothing else, also after pasting from Word/web pages:
      h2 h3 p br strong em ul ol li a[href]   (b/i are normalised to strong/em)
  Links always get target="_blank" rel="noopener" (they leave Primo).
  An "HTML" button switches to the raw markup for those who prefer it; the same
  cleaning applies when switching back.

  API (plain script, no modules — works with a <script src> tag):
      const rte = EcRichText.create(textarea, { onChange(html) {…} });
      rte.getHTML(); rte.setHTML(html);
  The textarea stays in the page (hidden while in visual mode) and always holds
  the current HTML, so existing code that reads textarea.value keeps working.
*/
(function () {
  'use strict';

  /**
   * Interface language (noob kit's COMMENCER ICI / EMPEZAR AQUI): window.EC_UI
   * from maker/ui-<lang>.js maps English texts to translations; without it the
   * English text is used. Same rule as t() in index.html (the English text is
   * the key; {name} placeholders are filled from `vars`). Kept local so this
   * file still works on its own. build-noob.cjs scans this file for t('…').
   */
  function t(text, vars) {
    const strings = (window.EC_UI && window.EC_UI.strings) || {};
    let s = Object.prototype.hasOwnProperty.call(strings, text) && strings[text] ? strings[text] : text;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  }

  /** Allowed elements → allowed attributes. Everything else is unwrapped or dropped. */
  const ALLOWED = { H2: [], H3: [], P: [], BR: [], STRONG: [], EM: [], UL: [], OL: [], LI: [], A: ['href'] };
  /** Equivalent tags normalised to the allowed ones. */
  const RENAME = { B: 'STRONG', I: 'EM', H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P' };
  /** Removed with their content (never useful in a message). */
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'XML', 'O:P']);

  /**
   * Clean HTML down to the allowed subset. Works on a detached document, so
   * nothing in the input can run (scripts, event handlers, images loading).
   */
  function clean(html) {
    const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
    walk(doc.body);
    // Tidy: drop empty paragraphs/headings, collapse leading/trailing <br>.
    doc.body.querySelectorAll('p,h2,h3,li').forEach((n) => {
      if (!n.textContent.trim() && !n.querySelector('br,a')) n.remove();
    });
    return pretty(doc.body.innerHTML.trim());

    function walk(node) {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) { child.remove(); continue; }          // comments (Word puts lots)
        if (child.nodeType !== 1) continue;                              // text stays
        let tag = child.tagName.toUpperCase();
        if (DROP.has(tag)) { child.remove(); continue; }
        // A <div> becomes a paragraph only when it holds inline content; a <div>
        // wrapping blocks (headings, paragraphs, lists) is just unwrapped —
        // otherwise we would create invalid <p><h2>…</h2></p>.
        if (tag === 'DIV' && child.querySelector('h1,h2,h3,h4,h5,h6,p,ul,ol,li,div,table,blockquote')) {
          walk(child);
          child.replaceWith(...child.childNodes);
          continue;
        }
        if (RENAME[tag]) {
          const repl = child.ownerDocument.createElement(RENAME[tag]);
          while (child.firstChild) repl.appendChild(child.firstChild);
          child.replaceWith(repl);
          walk(repl);
          sanitizeAttrs(repl, RENAME[tag]);
          continue;
        }
        walk(child);
        if (!ALLOWED[tag]) {                                             // unknown: keep the text, lose the tag
          child.replaceWith(...child.childNodes);
          continue;
        }
        sanitizeAttrs(child, tag);
      }
    }
    function sanitizeAttrs(el, tag) {
      for (const a of [...el.attributes]) if (!ALLOWED[tag].includes(a.name)) el.removeAttribute(a.name);
      if (tag === 'A') {
        const href = el.getAttribute('href') || '';
        if (!/^(https?:|mailto:)/i.test(href)) { el.replaceWith(...el.childNodes); return; } // no javascript: etc.
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    }
  }

  /** One block element per line, so the HTML view stays readable. */
  function pretty(html) {
    return html
      .replace(/\s*(<\/?(h2|h3|p|ul|ol|li)>)\s*/g, '$1')
      .replace(/(<\/(h2|h3|p|ul|ol)>)/g, '$1\n')
      .replace(/(<(ul|ol)>)/g, '$1\n')
      .replace(/(<\/li>)/g, '$1\n')
      .replace(/<li>/g, '  <li>')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  const BUTTONS = [
    { cmd: 'formatBlock', arg: 'H2', label: 'H', title: t('Heading'), cls: 'h' },
    { cmd: 'formatBlock', arg: 'P', label: '¶', title: t('Normal text') },
    { cmd: 'bold', label: 'B', title: t('Bold'), cls: 'b' },
    { cmd: 'italic', label: 'I', title: t('Italic'), cls: 'i' },
    { cmd: 'insertUnorderedList', label: '•', title: t('Bulleted list') },
    { cmd: 'insertOrderedList', label: '1.', title: t('Numbered list') },
    { cmd: 'link', label: '🔗', title: t('Link') },
    { cmd: 'removeFormat', label: '⌫', title: t('Remove formatting') },
  ];

  let stylesAdded = false;
  function addStyles() {
    if (stylesAdded) return;
    stylesAdded = true;
    const s = document.createElement('style');
    s.textContent = `
      .ec-rte { border:1px solid #d9d9d9; border-radius:.375rem; background:#fff; }
      .ec-rte__bar { display:flex; flex-wrap:wrap; gap:.25rem; padding:.3rem; border-bottom:1px solid #eee; background:#f6f7f9; border-radius:.375rem .375rem 0 0; }
      .ec-rte__bar button { min-width:2rem; padding:.2rem .45rem; border:1px solid #d9d9d9; border-radius:.3rem; background:#fff; color:#1b1b1b; font:inherit; font-size:.85rem; cursor:pointer; }
      .ec-rte__bar button:hover { border-color:#004494; color:#004494; }
      .ec-rte__bar button.b { font-weight:700; } .ec-rte__bar button.i { font-style:italic; } .ec-rte__bar button.h { font-weight:700; }
      .ec-rte__bar .sep { flex:1; }
      .ec-rte__bar button[aria-pressed=true] { background:#004494; color:#fff; border-color:#004494; }
      .ec-rte__area { min-height:9rem; max-height:28rem; overflow:auto; padding:.6rem .75rem; outline:none; font:15px/1.5 Arial,sans-serif; color:#1b1b1b; }
      .ec-rte__area:focus { box-shadow: inset 0 0 0 2px #00449433; }
      .ec-rte__area h2, .ec-rte__area h3 { font-size:1.1rem; color:#004494; margin:.9rem 0 .3rem; }
      .ec-rte__area > :first-child { margin-top:0; }
      .ec-rte__area p { margin:0 0 .6rem; } .ec-rte__area a { color:#004494; }
      .ec-rte__area:empty::before { content:attr(data-placeholder); color:#9a9a9a; }
      .ec-rte textarea.ec-rte__src { border:0; border-radius:0 0 .375rem .375rem; min-height:9rem; width:100%; font:13px/1.45 ui-monospace,Consolas,monospace; padding:.6rem .75rem; resize:vertical; }`;
    document.head.appendChild(s);
  }

  /**
   * Turn a <textarea> into a rich-text editor.
   * @param {HTMLTextAreaElement} textarea  holds the HTML; stays the source of truth
   * @param {{onChange?: (html: string) => void, placeholder?: string}} opts
   */
  function create(textarea, opts = {}) {
    addStyles();
    const box = document.createElement('div');
    box.className = 'ec-rte';
    const bar = document.createElement('div');
    bar.className = 'ec-rte__bar';
    bar.setAttribute('role', 'toolbar');
    const area = document.createElement('div');
    area.className = 'ec-rte__area';
    area.contentEditable = 'true';
    area.setAttribute('role', 'textbox');
    area.setAttribute('aria-multiline', 'true');
    if (textarea.getAttribute('aria-label')) area.setAttribute('aria-label', textarea.getAttribute('aria-label'));
    area.dataset.placeholder = opts.placeholder || t('Empty — type the message here');

    textarea.classList.add('ec-rte__src');
    textarea.hidden = true;
    textarea.parentNode.insertBefore(box, textarea);
    box.append(bar, area, textarea);

    let sourceMode = false;
    const emit = () => { if (opts.onChange) opts.onChange(textarea.value); };
    const syncFromArea = () => { textarea.value = clean(area.innerHTML); emit(); };

    for (const b of BUTTONS) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = b.label; btn.title = b.title; btn.setAttribute('aria-label', b.title);
      if (b.cls) btn.className = b.cls;
      btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection in the text
      btn.addEventListener('click', () => {
        if (sourceMode) return;
        area.focus();
        if (b.cmd === 'link') {
          const url = prompt(t('Link address (https://…). Leave empty to remove the link:'), 'https://');
          if (url === null) return;
          if (url === '' || url === 'https://') document.execCommand('unlink');
          else document.execCommand('createLink', false, url);
        } else {
          document.execCommand(b.cmd, false, b.arg || null);
        }
        syncFromArea();
      });
      bar.appendChild(btn);
    }
    const sep = document.createElement('span'); sep.className = 'sep'; bar.appendChild(sep);
    const srcBtn = document.createElement('button');
    srcBtn.type = 'button'; srcBtn.textContent = 'HTML'; srcBtn.title = t('Show / edit the HTML markup');
    srcBtn.setAttribute('aria-pressed', 'false');
    srcBtn.addEventListener('click', () => {
      sourceMode = !sourceMode;
      srcBtn.setAttribute('aria-pressed', String(sourceMode));
      if (sourceMode) { textarea.value = clean(area.innerHTML); textarea.hidden = false; area.hidden = true; textarea.focus(); }
      else { area.innerHTML = clean(textarea.value); textarea.value = clean(area.innerHTML); textarea.hidden = true; area.hidden = false; emit(); }
    });
    bar.appendChild(srcBtn);

    // Typing in the visual area keeps the (hidden) textarea up to date.
    area.addEventListener('input', syncFromArea);
    // Typing in source mode: pass the raw text on; it is cleaned when switching back.
    textarea.addEventListener('input', () => { if (sourceMode) emit(); });
    // Paste: never bring in foreign formatting — clean whatever comes in.
    area.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      const safe = html ? clean(html) : escapeText(text).replace(/\r?\n\r?\n/g, '</p><p>').replace(/\r?\n/g, '<br>');
      document.execCommand('insertHTML', false, html ? safe : `<p>${safe}</p>`);
      syncFromArea();
    });
    // Enter makes paragraphs, not <div>s.
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) { /* older browsers */ }

    area.innerHTML = clean(textarea.value);
    return {
      getHTML: () => (sourceMode ? textarea.value : clean(area.innerHTML)),
      setHTML: (h) => { area.innerHTML = clean(h); textarea.value = clean(h); },
      element: box,
    };
  }

  function escapeText(t) {
    return String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  window.EcRichText = { create, clean };
})();
