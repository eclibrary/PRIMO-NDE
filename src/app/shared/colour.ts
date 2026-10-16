// src/app/shared/colour.ts
//
// Colour helpers for colours picked in the settings (colour picker fields,
// schema "format": "color"): notice banners with "My own colour".
//
// readableTextOn(background) → '#000000' or '#ffffff', whichever contrasts
// more with the background (WCAG relative luminance). That is how a banner in
// any colour stays readable without the library having to pick a text colour.

/** [r, g, b] 0–255, or null when `colour` is not understood. */
export function parseColour(colour: string): [number, number, number] | null {
  const c = (colour ?? '').trim();
  // #rgb / #rrggbb — what the colour picker produces.
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (m) return [m[1], m[2], m[3]].map((h) => parseInt(h + h, 16)) as [number, number, number];
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (m) return [m[1], m[2], m[3]].map((h) => parseInt(h, 16)) as [number, number, number];
  // Anything else CSS understands (named colours, rgb(), hsl(), …): let the
  // browser resolve it on a detached-from-layout probe element.
  if (!c || typeof document === 'undefined' || !document.body) return null;
  const probe = document.createElement('span');
  probe.style.color = c;
  if (!probe.style.color) return null; // not a valid CSS colour
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color; // "rgb(r, g, b)" or "rgba(…)"
  probe.remove();
  const parts = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(rgb);
  return parts ? [Number(parts[1]), Number(parts[2]), Number(parts[3])] : null;
}

/** WCAG 2 relative luminance of an sRGB colour (0 = black, 1 = white). */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Black or white text, whichever has the higher contrast on `background`.
 * Unknown colour → white (our presets and theme colours are dark).
 */
export function readableTextOn(background: string): '#000000' | '#ffffff' {
  const rgb = parseColour(background);
  if (!rgb) return '#ffffff';
  const L = luminance(rgb);
  // Contrast with white = 1.05 / (L + .05); with black = (L + .05) / .05.
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
}
