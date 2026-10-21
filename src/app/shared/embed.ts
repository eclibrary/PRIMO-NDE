// src/app/shared/embed.ts
//
// THIRD-PARTY WIDGETS FROM EMBED CODE — shared by
//   - custom dialogs   (customDialogs.dialogs[].widget, ec-custom-dialogs.component.ts)
//   - Ask a librarian  (askALibrarian.widgetCode,        ec-ask-librarian.component.ts)
//
// An embed code is what a provider gives you to paste into a page: some
// elements (usually a <div id="…">) and one or more <script>s. Putting it in
// with innerHTML is not enough — browsers never run scripts inserted that way.
// insertEmbed() therefore copies the elements and RE-CREATES each script, so
// the browser runs it, in document order, each at its own place in the code
// (some widgets draw themselves next to their own <script> tag). External
// scripts are chained: each waits for the previous one, because embed codes
// often load a library first and then call it from an inline script.
// Embed codes that use document.write (older widgets) are handled too: see
// DOCUMENT.WRITE at insertEmbed().
//
// The code is NOT sanitised: it is meant to run. It comes from settings.js,
// which only people who can upload the whole package can change — see the
// SAFETY note in runtime-settings.ts.
//
// SHADOW ROOTS: some widgets (LibAnswers' question form) draw their form in a
// CLOSED shadow root, which page code cannot normally reach — so neither our
// prefill nor custom CSS could get in. trackShadowRoots() wraps
// Element.prototype.attachShadow so every shadow root created from then on is
// remembered (in a WeakMap: nothing is kept alive, nothing is changed — the
// root keeps its own mode). It must run BEFORE the widget's script does; the
// Ask-a-librarian component calls it when it starts. shadowRootsIn() then
// finds the roots inside a container, open or closed, nested ones included.
// (The Europa helper script the EC used until Oct 2026 did the same trick.)

/** Shadow roots by host element, open or closed (see trackShadowRoots). */
const ROOTS = new WeakMap<Element, ShadowRoot>();
let tracking = false;

/** Remember every shadow root attached from now on. Safe to call more than once. */
export function trackShadowRoots(): void {
  if (tracking || typeof Element === 'undefined' || !Element.prototype.attachShadow) return;
  tracking = true;
  const original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
    const root = original.call(this, init);
    ROOTS.set(this, root);
    return root;
  };
}

/** All shadow roots inside `container` (open, or closed but tracked), nested ones too. */
export function shadowRootsIn(container: ParentNode): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  const walk = (node: ParentNode) => {
    node.querySelectorAll('*').forEach((el) => {
      const root = el.shadowRoot ?? ROOTS.get(el);
      if (root && !found.includes(root)) {
        found.push(root);
        walk(root);
      }
    });
  };
  walk(container);
  return found;
}

/**
 * Put an embed code into `container` (which must already be in the page:
 * widgets look up their <div> by id) and run its scripts. Resolves when every
 * script has run; rejects when an external script fails to load (the others
 * still run). Call it again on an emptied container to start the widget anew.
 *
 * DOCUMENT.WRITE (older widgets, e.g. LibAnswers' older question form): a
 * script that writes HTML with document.write expects to run WHILE the page
 * loads; called later, document.write throws the whole page away. So while
 * the embed's scripts run, document.write / writeln are replaced: the HTML is
 * put right before the script that writes it (or at the end of the container),
 * and scripts inside it are queued to run next, as the browser would. The
 * originals are restored as soon as the embed's last script has run.
 */
export function insertEmbed(container: HTMLElement, code: string): Promise<void> {
  const template = document.createElement('template');
  template.innerHTML = code; // inert: nothing in a <template> runs or loads
  container.append(document.importNode(template.content, true));

  // Scripts waiting to run, in order: each with the spot it goes to.
  const queue: Array<{ script: HTMLScriptElement; spot: Node }> = [];
  takeScripts(container, queue);

  let failed: string | null = null;
  let current: HTMLScriptElement | null = null;

  // document.write / writeln → into the container (see DOCUMENT.WRITE above).
  const originalWrite = document.write;
  const originalWriteln = document.writeln;
  const capture = (html: string) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    const nodes = document.importNode(t.content, true);
    const written: Array<{ script: HTMLScriptElement; spot: Node }> = [];
    takeScripts(nodes, written);
    if (current?.parentNode && container.contains(current)) current.parentNode.insertBefore(nodes, current);
    else container.append(nodes);
    queue.unshift(...written); // written scripts run next, before the remaining ones
  };
  document.write = (...parts: string[]) => capture(parts.join(''));
  document.writeln = (...parts: string[]) => capture(parts.join('') + '\n');
  const restore = () => { document.write = originalWrite; document.writeln = originalWriteln; };

  // Run the queue one script at a time (external ones wait for their load).
  const next = (): Promise<void> => {
    const item = queue.shift();
    if (!item) return Promise.resolve();
    const { script, spot } = item;
    return new Promise<void>((done) => {
      current = script;
      if (script.src) {
        script.addEventListener('load', () => done(), { once: true });
        script.addEventListener('error', () => { failed ??= script.src; done(); }, { once: true });
      }
      if (spot.parentNode) spot.parentNode.replaceChild(script, spot); // in the page → the browser runs it
      else container.append(script);
      if (!script.src) done(); // inline scripts run on insertion
    }).then(next);
  };

  return next().then(
    () => { restore(); if (failed) throw new Error(`widget script did not load: ${failed}`); },
    (err) => { restore(); throw err; },
  );
}

/**
 * Swap every <script> under `root` for a placeholder comment and queue a fresh
 * copy for that spot (scripts copied or parsed via innerHTML never run).
 * Not async: the order of the embed code is kept.
 */
function takeScripts(root: ParentNode, queue: Array<{ script: HTMLScriptElement; spot: Node }>): void {
  root.querySelectorAll('script').forEach((old) => {
    const fresh = document.createElement('script');
    for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value);
    fresh.text = old.text;
    if (fresh.src) fresh.async = false;
    const spot = document.createComment(' ec: embed script ');
    old.replaceWith(spot);
    queue.push({ script: fresh, spot });
  });
}
