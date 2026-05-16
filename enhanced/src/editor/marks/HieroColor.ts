/* --------------------------------------------------------------------------
 *  HieroColor — a TipTap Mark that carries a CSS color on a text range.
 *
 *  Color isn't a Unicode property, so we attach it as a Mark — same
 *  shape as HieroRotation: metadata travels with the range through
 *  undo / copy / paste / serialisation, and ProseMirror coalesces
 *  same-color neighbours into one span.
 *
 *  Editor display: the mark renders as
 *    `<span class="hiero-color" data-hiero-color="<css>" style="color: <css>">…</span>`
 *  The inline `color` colours both Latin glyphs (rendered as text in
 *  the editor) and the hieroglyph codepoints (drawn from the
 *  NewGardiner font), because the editor is plain contenteditable
 *  text — not SVG.
 *
 *  Preview display: see Preview.tsx — adjacent chars sharing kind +
 *  rotation + color merge into one segment. For hieroglyph segments,
 *  HieroJax reads `color` off the host span's computed style and
 *  bakes it into the SVG's `fill` attributes. That means a single
 *  inline `color` rule colors both the SVG paths AND any text the
 *  segment contains, with no SVG-specific code.
 *
 *  We accept any CSS color string. The popover hands us hex, but
 *  rgb()/named colors round-trip too — the value is stored verbatim
 *  and the renderer just trusts the browser to interpret it. Passing
 *  the empty string clears the mark.
 * ------------------------------------------------------------------------ */

import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    hieroColor: {
      /** Apply `color` (any CSS color string) to the selection.
       *  Passing `null` or `""` clears the mark. */
      setHieroColor: (color: string | null) => ReturnType;
      /** Strip color from the current selection. */
      unsetHieroColor: () => ReturnType;
    };
  }
}

/** Lightweight sanity check. We don't want to commit obviously
 *  malformed values to the doc (they'd survive copy / paste and
 *  pollute serialisation). Accepts:
 *    - `#rgb` / `#rrggbb` / `#rrggbbaa`
 *    - `rgb(...)` / `rgba(...)` / `hsl(...)` / `hsla(...)`
 *    - bare CSS color keywords (alpha-letters only)
 *  Anything else is rejected silently and treated as "no color". */
const isPlausibleColor = (s: string): boolean => {
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;
  if (/^(rgb|hsl)a?\([^)]+\)$/i.test(s)) return true;
  if (/^[a-zA-Z]+$/.test(s)) return true;
  return false;
};

export const HieroColor = Mark.create({
  name: "hieroColor",

  // Typing past the right edge of a colored char shouldn't keep
  // painting the next characters in the same color — matches the
  // behaviour we picked for HieroRotation.
  inclusive: false,

  addAttributes() {
    return {
      color: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-hiero-color"),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-hiero-color]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const v = el.getAttribute("data-hiero-color");
          return v && isPlausibleColor(v) ? { color: v } : false;
        },
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = String(mark.attrs.color ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "hiero-color",
        "data-hiero-color": color,
        // Inline color drives both the editor text and (via
        // computed style at processing time) the HieroJax SVG fill.
        style: `color: ${color}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setHieroColor:
        (color: string | null) =>
        ({ commands }) => {
          if (!color) return commands.unsetMark(this.name);
          const trimmed = color.trim();
          if (!trimmed || !isPlausibleColor(trimmed)) {
            return commands.unsetMark(this.name);
          }
          return commands.setMark(this.name, { color: trimmed });
        },
      unsetHieroColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
