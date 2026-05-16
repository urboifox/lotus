/* --------------------------------------------------------------------------
 *  HieroRotation — a TipTap Mark that carries a rotation angle (deg)
 *  on a text range.
 *
 *  Rotation isn't a Unicode codepoint, so we can't encode it as text
 *  the way joiners / cartouche brackets do. A Mark is the right
 *  fit: it attaches metadata to a text range, participates in undo /
 *  copy / paste, and renders to DOM via `renderHTML`.
 *
 *  Editor display: the mark renders as `<span class="hiero-rot"
 *  style="--hiero-rot: <deg>deg">…</span>`. The CSS in Editor.css
 *  applies the actual transform; ProseMirror coalesces same-mark
 *  ranges into one span, so a rotated multi-sign selection rotates
 *  as a single block.
 *
 *  Preview display: see Preview.tsx — contiguous chars sharing both
 *  the same `kind` and the same rotation merge into one segment, so
 *  a rotated quadrat (signs + format-control joiners) goes through
 *  HieroJax as ONE run and the resulting SVG is rotated by CSS.
 *  That matches how JSesh rotates groups: the laid-out quadrat
 *  rotates as a unit, so each sign appears rotated in the right
 *  place — instead of being splintered into per-codepoint spans
 *  that lose the joiners.
 * ------------------------------------------------------------------------ */

import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    hieroRotation: {
      /** Apply a rotation (deg, 0..359) to every character in the
       *  current selection. Passing 0 clears the mark. */
      setHieroRotation: (degrees: number) => ReturnType;
      /** Strip rotation from the current selection. */
      unsetHieroRotation: () => ReturnType;
    };
  }
}

export const HieroRotation = Mark.create({
  name: "hieroRotation",

  // Typing at the right edge of a rotated char shouldn't auto-rotate
  // the new char.
  inclusive: false,

  addAttributes() {
    return {
      degrees: {
        default: 0,
        parseHTML: (el) =>
          Number(el.getAttribute("data-hiero-rotation")) || 0,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-hiero-rotation]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const v = Number(el.getAttribute("data-hiero-rotation"));
          return v ? { degrees: v } : false;
        },
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const deg = Number(mark.attrs.degrees) || 0;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "hiero-rot",
        "data-hiero-rotation": String(deg),
        // Inline style drives the CSS variable; the actual transform
        // rule lives in Editor.css.
        style: `--hiero-rot: ${deg}deg`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setHieroRotation:
        (degrees: number) =>
        ({ commands }) => {
          // Normalise into 0..359 so we don't end up with negative
          // values floating around the doc.
          const d = ((Math.round(degrees) % 360) + 360) % 360;
          if (d === 0) return commands.unsetMark(this.name);
          return commands.setMark(this.name, { degrees: d });
        },
      unsetHieroRotation:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
