/* --------------------------------------------------------------------------
 *  Pure string transforms for the toolbar's hieroglyph commands.
 *
 *  Each `RangeCommand` takes the SELECTED text and returns a
 *  `RangeEdit` describing what to put in its place, plus where the
 *  new selection should land within the replacement. The toolbar
 *  glue dispatches a single ProseMirror `insertText` transaction.
 *
 *  Keeping these as pure string functions means they're framework-
 *  agnostic, trivially testable, and easy to reason about. They have
 *  zero knowledge of the editor.
 *
 *  --- Why these specific Unicode codepoints ----------------------------
 *
 *  Joiners (U+13430 vertical, U+13431 horizontal) tell HieroJax to
 *  stack adjacent signs into a quadrat. They render as zero-width in
 *  plain fonts, so the editor pane shows the signs side-by-side and
 *  the preview pane shows the rendered quadrat.
 *
 *  Cartouches need TWO things:
 *    1. The OPENING_CHAR / CLOSING_CHAR signs (U+13379 / U+1337A) for
 *       the visible cap shape.
 *    2. The BEGIN/END_ENCLOSURE_CHAR format-controls (U+1343C / U+1343D)
 *       so HieroJax's grammar treats the wrapped text as one
 *       enclosure rather than a flat sequence.
 *
 *  Without (2), HieroJax draws standalone delimiters at each end and
 *  no enclosure shape is formed. See `hierojax/src/syntax.jison` for
 *  the grammar rule.
 * ------------------------------------------------------------------------ */

import {
  CARTOUCHE_CLOSE,
  CARTOUCHE_OPEN,
  DAMAGE_BASE,
  HORIZONTAL_JOINER,
  VERTICAL_JOINER,
  damageChar,
  isHieroDamage,
  isHieroFormat,
  isHieroSign,
} from "./unicode";

const BEGIN_ENCLOSURE = "\u{1343C}";
const END_ENCLOSURE = "\u{1343D}";
/** Walled variants of the enclosure controls. HieroJax draws a
 *  thicker, palace-facade-style border instead of the thin rectangle
 *  it draws around `BEGIN_ENCLOSURE … END_ENCLOSURE`. The two pairs
 *  are interchangeable from the parser's point of view — the only
 *  visible difference is the border treatment. */
const BEGIN_WALLED_ENCLOSURE = "\u{1343E}";
const END_WALLED_ENCLOSURE = "\u{1343F}";

/** O006a — top-left corner of the rectangular hwt-frame enclosure. */
const HWT_OPEN = "\u{13258}";
/** O006d — bottom-right corner of the rectangular hwt-frame enclosure. */
const HWT_CLOSE = "\u{1325B}";

/** A single enclosure variant. `open` and `close` bracket the
 *  selected text; for HieroJax to draw a real enclosure shape both
 *  must include either the BEGIN/END_ENCLOSURE format-controls or
 *  the cartouche delimiter signs (or both, see ROYAL_CARTOUCHE). */
export interface CartoucheVariant {
  /** Stable id, used by the toolbar's active-state logic. */
  id: string;
  /** Human label for the popover button. */
  label: string;
  /** Inserted before the selected text. */
  open: string;
  /** Inserted after the selected text. */
  close: string;
  /** Sample text used for the popover preview tile. */
  sample: string;
}

/** Standard royal cartouche — the V10 / V11 caps plus the BEGIN /
 *  END_ENCLOSURE format-controls so HieroJax draws the rounded
 *  cartouche rectangle. */
export const ROYAL_CARTOUCHE: CartoucheVariant = {
  id: "royal",
  label: "Royal cartouche",
  open: CARTOUCHE_OPEN + BEGIN_ENCLOSURE,
  close: END_ENCLOSURE + CARTOUCHE_CLOSE,
  sample: CARTOUCHE_OPEN + BEGIN_ENCLOSURE + "\u{13000}\u{13013}" + END_ENCLOSURE + CARTOUCHE_CLOSE,
};

/** Plain enclosure — just the BEGIN / END format-controls, no
 *  delimiter caps. HieroJax draws a thin rectangle around the
 *  contents. Useful for grouping without the royal connotation. */
export const PLAIN_ENCLOSURE: CartoucheVariant = {
  id: "plain",
  label: "Plain enclosure",
  open: BEGIN_ENCLOSURE,
  close: END_ENCLOSURE,
  sample: BEGIN_ENCLOSURE + "\u{13000}\u{13013}" + END_ENCLOSURE,
};

/** Walled royal cartouche — same V011a / V011b caps as the standard
 *  royal cartouche, but with the WALLED enclosure controls. HieroJax
 *  thickens the border into a decorative palace-facade frame, which
 *  scribes used to emphasise the divinity of the enclosed name. */
export const WALLED_CARTOUCHE: CartoucheVariant = {
  id: "walled-royal",
  label: "Walled cartouche",
  open: CARTOUCHE_OPEN + BEGIN_WALLED_ENCLOSURE,
  close: END_WALLED_ENCLOSURE + CARTOUCHE_CLOSE,
  sample:
    CARTOUCHE_OPEN +
    BEGIN_WALLED_ENCLOSURE +
    "\u{13000}\u{13013}" +
    END_WALLED_ENCLOSURE +
    CARTOUCHE_CLOSE,
};

/** Hwt frame (hwt = "house / temple"). The corner signs U+13258 /
 *  U+1325B render as the rectangular hwt enclosure scribes used
 *  around temple, estate and place names — distinct from the oval
 *  royal cartouche. The plain enclosure controls form the rectangle
 *  itself; the two corner signs anchor it to the baseline so the
 *  frame sits like a proper "hwt" sign rather than a free-floating
 *  rectangle. */
export const HWT_FRAME: CartoucheVariant = {
  id: "hwt",
  label: "Hwt frame",
  open: HWT_OPEN + BEGIN_ENCLOSURE,
  close: END_ENCLOSURE + HWT_CLOSE,
  sample:
    HWT_OPEN +
    BEGIN_ENCLOSURE +
    "\u{13000}\u{13013}" +
    END_ENCLOSURE +
    HWT_CLOSE,
};

/** Serekh — the bare walled enclosure with no caps. Traditionally
 *  the rectangular palace-facade frame that holds a king's Horus
 *  name (the Horus falcon sits ON TOP of the serekh; we draw just
 *  the frame here and the user can prefix a falcon manually). The
 *  walled enclosure's own border carries the facade texture. */
export const SEREKH: CartoucheVariant = {
  id: "serekh",
  label: "Serekh",
  open: BEGIN_WALLED_ENCLOSURE,
  close: END_WALLED_ENCLOSURE,
  sample:
    BEGIN_WALLED_ENCLOSURE + "\u{13000}\u{13013}" + END_WALLED_ENCLOSURE,
};

export const CARTOUCHE_VARIANTS: readonly CartoucheVariant[] = [
  ROYAL_CARTOUCHE,
  WALLED_CARTOUCHE,
  HWT_FRAME,
  SEREKH,
  PLAIN_ENCLOSURE,
];

export interface RangeEdit {
  /** What to put in place of the selection. */
  replacement: string;
  /** New selection offsets, as JS UTF-16 indices in `replacement`.
   *  The caller adds the original document `from` to translate to
   *  document positions. */
  selFrom: number;
  selTo: number;
}

export type RangeCommand = (selected: string) => RangeEdit | null;

const isHieroSignChar = (ch: string): boolean => {
  const cp = ch.codePointAt(0);
  return cp != null && isHieroSign(cp);
};

const isHieroFormatChar = (ch: string): boolean => {
  const cp = ch.codePointAt(0);
  return cp != null && isHieroFormat(cp);
};

const isHieroDamageChar = (ch: string): boolean => {
  const cp = ch.codePointAt(0);
  return cp != null && isHieroDamage(cp);
};

/** Insert `joiner` between every adjacent pair of hieroglyph signs
 *  in `s`, replacing any joiner already there. Other format-controls
 *  (cartouche / segment delimiters) are left alone, so wrapping
 *  structure survives a re-grouping. Idempotent. */
const joinSigns = (s: string, joiner: string): string => {
  const cps = [...s];
  const out: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    out.push(cps[i]);
    if (!isHieroSignChar(cps[i])) continue;
    let j = i + 1;
    while (
      j < cps.length &&
      (cps[j] === VERTICAL_JOINER || cps[j] === HORIZONTAL_JOINER)
    ) {
      j++;
    }
    if (j < cps.length && isHieroSignChar(cps[j])) {
      out.push(joiner);
      i = j - 1;
    }
  }
  return out.join("");
};

const buildEdit = (next: string, original: string): RangeEdit | null =>
  next === original
    ? null
    : { replacement: next, selFrom: 0, selTo: next.length };

export const groupVertical: RangeCommand = (s) =>
  buildEdit(joinSigns(s, VERTICAL_JOINER), s);

export const groupHorizontal: RangeCommand = (s) =>
  buildEdit(joinSigns(s, HORIZONTAL_JOINER), s);

export const ungroup: RangeCommand = (s) => {
  // Damage markers are technically format-controls but conceptually
  // belong TO the sign they follow — stripping them on an "Ungroup"
  // would silently delete the user's shading state. Preserve them.
  const next = [...s]
    .filter((ch) => !isHieroFormatChar(ch) || isHieroDamageChar(ch))
    .join("");
  return buildEdit(next, s);
};

/* ----- Damage (per-sign shading) ----------------------------------------
 *
 * Damage is a 4-bit "which quarters are shaded" attribute per sign.
 * Level 0 = clean. Levels 1..15 are stored as a single codepoint
 * (U+13447 + (level-1) ... see unicode.ts). The marker sits
 * immediately after the sign codepoint and is consumed by HieroJax's
 * parser as a property of that sign.
 *
 * `setDamage` walks the selection and, for every sign codepoint,
 * rewrites the damage marker that follows it (inserting one if there
 * was none). Passing level 0 strips every damage marker in the range.
 * Idempotent — re-applying the same level is a no-op. */

/** Append (or replace) a damage marker after every sign in `s`.
 *  Other characters are kept verbatim so joiners / cartouche caps /
 *  Latin text all survive a shading operation. */
const applyDamage = (s: string, level: number): string => {
  const out: string[] = [];
  const cps = [...s];
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    out.push(ch);
    if (!isHieroSignChar(ch)) continue;
    // Skip any existing damage marker (always a single codepoint).
    if (i + 1 < cps.length && isHieroDamageChar(cps[i + 1])) i++;
    if (level > 0) out.push(damageChar(level));
  }
  return out.join("");
};

/** Toolbar-facing command: produces the new range text for the chosen
 *  damage level. */
export const setDamage = (level: number): RangeCommand => (s) =>
  buildEdit(applyDamage(s, level), s);

/** Damage level shared by every sign in `s`, or null if signs disagree
 *  (or there are no signs at all). Drives the popover's active tile. */
export const detectDamage = (s: string): number | null => {
  let seen: number | null = null;
  const cps = [...s];
  for (let i = 0; i < cps.length; i++) {
    if (!isHieroSignChar(cps[i])) continue;
    let level = 0;
    if (i + 1 < cps.length && isHieroDamageChar(cps[i + 1])) {
      const cp = cps[i + 1].codePointAt(0)!;
      level = cp - DAMAGE_BASE;
      i++;
    }
    if (seen == null) seen = level;
    else if (seen !== level) return null;
  }
  return seen;
};

/** True if any sign in `s` carries a damage marker. */
export const hasDamage = (s: string): boolean => {
  for (const ch of s) if (isHieroDamageChar(ch)) return true;
  return false;
};

/** True if `s` is bracketed by `variant.open` / `variant.close`. */
const isWrappedWith = (s: string, v: CartoucheVariant): boolean =>
  s.startsWith(v.open) &&
  s.endsWith(v.close) &&
  s.length >= v.open.length + v.close.length;

/** Toggle / switch a cartouche variant on the selection.
 *
 *  - already wrapped with `variant`         → unwrap
 *  - wrapped with a different known variant → replace with `variant`
 *  - not wrapped                            → wrap with `variant`
 */
export const setCartouche =
  (variant: CartoucheVariant): RangeCommand =>
  (s) => {
    if (isWrappedWith(s, variant)) {
      const inner = s.slice(variant.open.length, s.length - variant.close.length);
      return { replacement: inner, selFrom: 0, selTo: inner.length };
    }
    for (const v of CARTOUCHE_VARIANTS) {
      if (v.id !== variant.id && isWrappedWith(s, v)) {
        const inner = s.slice(v.open.length, s.length - v.close.length);
        const wrapped = variant.open + inner + variant.close;
        return { replacement: wrapped, selFrom: 0, selTo: wrapped.length };
      }
    }
    if (!s) return null;
    const wrapped = variant.open + s + variant.close;
    return { replacement: wrapped, selFrom: 0, selTo: wrapped.length };
  };

/** Backwards-compatible name — toggles the royal cartouche. */
export const toggleCartouche: RangeCommand = setCartouche(ROYAL_CARTOUCHE);

/* ----- Predicates the toolbar uses for active / disabled states --------- */

/** At least one hieroglyph sign codepoint. */
export const hasHieroSign = (s: string): boolean => {
  for (const ch of s) if (isHieroSignChar(ch)) return true;
  return false;
};

/** Any joiner / enclosure / segment format-control codepoint.
 *  Excludes damage markers, since `Ungroup` preserves those — gating
 *  the button on them would let the user click a no-op. */
export const hasFormatControl = (s: string): boolean => {
  for (const ch of s) {
    if (isHieroFormatChar(ch) && !isHieroDamageChar(ch)) return true;
  }
  return false;
};

/** Detect which (if any) known cartouche variant wraps `s`. The
 *  toolbar uses this to highlight the matching variant in its
 *  popover and to toggle the trigger active. */
export const detectCartouche = (s: string): CartoucheVariant | null => {
  for (const v of CARTOUCHE_VARIANTS) if (isWrappedWith(s, v)) return v;
  return null;
};

/** True if `s` is wrapped with any known cartouche variant. */
export const isCartouche = (s: string): boolean => detectCartouche(s) != null;

/** True if every adjacent sign pair in `s` already has the given
 *  joiner. Drives the toolbar's "Group V/H" active highlight. */
export const isGroupedWith = (s: string, joiner: string): boolean => {
  const cps = [...s];
  let sawSignPair = false;
  for (let i = 0; i < cps.length; i++) {
    if (!isHieroSignChar(cps[i])) continue;
    let j = i + 1;
    while (
      j < cps.length &&
      (cps[j] === VERTICAL_JOINER || cps[j] === HORIZONTAL_JOINER)
    ) {
      j++;
    }
    if (j < cps.length && isHieroSignChar(cps[j])) {
      sawSignPair = true;
      // Need exactly one of OUR joiner between i and j.
      if (j - i !== 2 || cps[i + 1] !== joiner) return false;
      i = j - 1;
    }
  }
  return sawSignPair;
};

export const isGroupedVertically = (s: string): boolean =>
  isGroupedWith(s, VERTICAL_JOINER);

export const isGroupedHorizontally = (s: string): boolean =>
  isGroupedWith(s, HORIZONTAL_JOINER);
