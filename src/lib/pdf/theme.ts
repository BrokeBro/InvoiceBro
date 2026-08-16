// Shared design tokens for the three PDF templates.
//
// The point of centralising these is that the templates read as a family —
// three expressions of one design system, not three unrelated documents.
// Anything genuinely shared (scale, ink colours, page geometry) lives here;
// each template varies only layout and emphasis.
//
// Fonts are the built-in PDF base-14 (Helvetica). This is deliberate for
// serverless: registering a remote font makes @react-pdf/renderer fetch it at
// render time, which is the single most common way PDF routes fail on Vercel —
// a cold lambda with no network egress budget renders a blank page or times
// out. Base-14 fonts are embedded in every PDF reader on earth and need no
// files bundled at all.

export const FONT = {
  body: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;

/** Type scale, in points. */
export const SIZE = {
  micro: 7.5,
  small: 8.5,
  body: 9.5,
  lead: 11,
  heading: 14,
  display: 24,
} as const;

/** Neutral ink ramp. Accent colour comes from the organization's branding. */
export const INK = {
  strong: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  hairline: "#e2e8f0",
  wash: "#f8fafc",
  white: "#ffffff",
} as const;

export const PAGE = {
  padding: 44,
  gutter: 18,
} as const;

/**
 * A note on line spacing: the templates set no `lineHeight` at all.
 *
 * Two reasons, both learned the hard way:
 *
 *  1. In @react-pdf/renderer 4.6.1, a <Text render={…}> paints nothing when it
 *     inherits a lineHeight from its <Page>. The render callback still fires,
 *     so it fails silently — the page-number footer just disappears.
 *  2. Setting lineHeight on individual text styles works, but spaces lines far
 *     wider than the multiplier implies (1.3 was enough to push a ten-line
 *     invoice onto a second page).
 *
 * The renderer's own font-metric leading is well proportioned for a document
 * at these sizes, so we leave it alone. If you need looser copy, add space with
 * margins rather than lineHeight.
 */

/**
 * Pick readable text for a coloured background.
 *
 * An accent colour is user-supplied, so a template that prints white text on it
 * can't assume it's dark — pale yellow with white text would be unreadable.
 * Uses the WCAG relative-luminance formula rather than a naive RGB average,
 * because perceived brightness is dominated by green.
 */
export function readableTextOn(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return INK.white;

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

  return luminance > 0.55 ? INK.strong : INK.white;
}

/** A very light tint of the accent, for table headers and fills. */
export function tintOf(hexColor: string, alpha = 0.08): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return INK.wash;

  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

  // Composite against white so the result stays an opaque hex — react-pdf's
  // colour handling is happiest with solid values.
  const blend = (channel: number) => Math.round(255 - (255 - channel) * alpha);

  return `#${[blend(r), blend(g), blend(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
