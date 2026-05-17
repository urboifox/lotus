/* --------------------------------------------------------------------------
 *  Unicode constants and codepoint helpers for hieroglyph text.
 *
 *  Two blocks matter to us:
 *
 *    U+13000 .. U+1342F   Egyptian Hieroglyphs (the actual signs)
 *    U+13430 .. U+1345F   Egyptian Hieroglyph Format Controls
 *                         (joiners, insertions, cartouches, mirror,
 *                          damage marks — added in Unicode 12+)
 *
 *  Anything outside those ranges is plain text. Putting everything in
 *  one place means the auto-flow plugin, the toolbar commands, and
 *  the palette all agree on what counts as a hieroglyph.
 * ------------------------------------------------------------------------ */

/* ----- Sign codepoints ---------------------------------------------------- */

export const HIERO_SIGN_LO = 0x13000;
export const HIERO_SIGN_HI = 0x1342f;

/* ----- Format controls (L2/21-248 + Unicode 12+) ------------------------- */

export const FMT_LO = 0x13430;
export const FMT_HI = 0x1345f;

/** Vertical joiner — stacks the two adjacent signs into a quadrat. */
export const VERTICAL_JOINER = "\u{13430}";
/** Horizontal joiner — places the two adjacent signs side by side. */
export const HORIZONTAL_JOINER = "\u{13431}";

/** Begin/end sub-segment — wraps a sub-quadrat so joiners inside it
 *  bind tighter than joiners outside. We use these to nest groups. */
export const BEGIN_SEGMENT = "\u{13437}";
export const END_SEGMENT = "\u{13438}";

/** Default cartouche signs — Unicode encodes several variants
 *  (royal, walled, plain enclosure). 𓍹 / 𓍺 is the classic royal
 *  cartouche pair, which is what the client is replacing in JSesh. */
export const CARTOUCHE_OPEN = "\u{13379}"; // 𓍹
export const CARTOUCHE_CLOSE = "\u{1337a}"; // 𓍺

/* ----- Damage / shading markers ------------------------------------------
 *
 * Unicode encodes per-sign damage as a single codepoint that follows the
 * sign. Level 0 means "no marker present"; levels 1..15 use codepoints
 * U+13447..U+13455, where the level is a 4-bit field over the sign's
 * four quarters:
 *
 *   bit 0 = top-left,  bit 1 = bottom-left,
 *   bit 2 = top-right, bit 3 = bottom-right
 *
 * HieroJax draws each set quarter with diagonal hatching to represent
 * damaged or lost portions of the sign on the original inscription. */

export const DAMAGE_BASE = 0x13446;
export const DAMAGE_LO = 0x13447;
export const DAMAGE_HI = 0x13455;

/** Convert a damage level (1..15) into its single Unicode codepoint. */
export const damageChar = (level: number): string =>
  String.fromCodePoint(DAMAGE_BASE + level);

/** Invert: damage codepoint → level (1..15). Throws on out-of-range. */
export const damageLevel = (cp: number): number => cp - DAMAGE_BASE;

/* ----- Predicates --------------------------------------------------------- */

/** True if `cp` is an Egyptian hieroglyph sign. */
export const isHieroSign = (cp: number): boolean =>
  cp >= HIERO_SIGN_LO && cp <= HIERO_SIGN_HI;

/** True if `cp` is a hieroglyph FORMAT CONTROL character (joiner,
 *  insertion marker, enclosure boundary, damage marker, …). */
export const isHieroFormat = (cp: number): boolean =>
  cp >= FMT_LO && cp <= FMT_HI;

/** True if `cp` is a per-sign damage marker. Damage markers ARE
 *  format-controls, but they aren't "grouping" controls — `Ungroup`
 *  must not strip them, so we expose a separate predicate. */
export const isHieroDamage = (cp: number): boolean =>
  cp >= DAMAGE_LO && cp <= DAMAGE_HI;

/** True if `cp` belongs to either hieroglyph block — these are the
 *  codepoints the Preview pane groups into HieroJax-rendered runs. */
export const isHieroglyphic = (cp: number): boolean =>
  isHieroSign(cp) || isHieroFormat(cp);

/** True iff every codepoint in `s` belongs to a hieroglyph block. */
export const isAllHieroglyphic = (s: string): boolean => {
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined || !isHieroglyphic(cp)) return false;
  }
  return true;
};

/* ----- Codepoint splitting ----------------------------------------------- */

/** Iterate `s` by Unicode codepoint (handling surrogate pairs).
 *  Returns the array of single-codepoint strings, which is what the
 *  auto-flow plugin works with — counting JS string `.length` lies for
 *  codepoints above U+FFFF (every hieroglyph is one of those). */
export const codepoints = (s: string): string[] => Array.from(s);

/** Number of codepoints in `s` — NOT the same as `s.length`. */
export const codepointCount = (s: string): number => Array.from(s).length;
