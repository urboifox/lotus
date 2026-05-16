/* --------------------------------------------------------------------------
 *  Sample glyph catalogue.
 *
 *  In production this list will come from the admin dashboard — each row
 *  carries a Gardiner-style code, the Unicode character, and a "type"
 *  classification that mirrors JSesh's four shape categories. The editor
 *  uses `type` only for layout hints (e.g. "small" glyphs keep their
 *  natural size inside merged groups instead of stretching to fill a
 *  slot).
 *
 *  Each entry is one row in the side palette. Clicking inserts the
 *  unicode character at the caret — selection, deletion, cursor
 *  movement, and copy/paste all use the native text engine because the
 *  glyph is just a normal text codepoint with a hieroglyph font face.
 * ------------------------------------------------------------------------ */

export type GlyphType = "full" | "horizontal" | "vertical" | "small";

export interface Glyph {
  /** Gardiner sign-list code (or a stand-in for prototypes). */
  code: string;
  /** Unicode character — a single codepoint in the U+13000..U+1342F block. */
  char: string;
  /** Layout class. Drives merge-slot sizing later on. */
  type: GlyphType;
  /** Human-friendly label for the palette tooltip. */
  label: string;
}

export const GLYPHS: Glyph[] = [
  // Full / square — humans and large animals
  { code: "A1", char: "𓀀", type: "full", label: "Seated man" },
  { code: "G1", char: "𓄿", type: "full", label: "Egyptian vulture" },
  { code: "G17", char: "𓅓", type: "full", label: "Owl" },

  // Horizontal — wider than tall
  { code: "I9", char: "𓆑", type: "horizontal", label: "Horned viper" },
  { code: "N35", char: "𓈖", type: "horizontal", label: "Water ripple" },
  { code: "V30", char: "𓎟", type: "horizontal", label: "Basket" },

  // Vertical — taller than wide
  { code: "M17", char: "𓇋", type: "vertical", label: "Reed leaf" },
  { code: "Z1", char: "𓏤", type: "vertical", label: "Single stroke" },

  // Small — compact in both dimensions
  { code: "D21", char: "𓂋", type: "small", label: "Mouth" },
  { code: "X1", char: "𓏏", type: "small", label: "Bread loaf" },
];

/** Lookup table by code for fast inserts from external sources. */
export const GLYPHS_BY_CODE: Record<string, Glyph> = Object.fromEntries(
  GLYPHS.map((g) => [g.code, g]),
);
