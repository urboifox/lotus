/* --------------------------------------------------------------------------
 *  Top-of-editor toolbar.
 *
 *  Every hieroglyph-shaping action is a string operation on the
 *  selected text (see editor/commands.ts). The toolbar's only job is
 *  to:
 *
 *    1. Read the current selection and ask the pure-string commands
 *       what the new replacement / new selection should be.
 *    2. Dispatch a single ProseMirror transaction that swaps the
 *       text and parks the cursor on the new range.
 *    3. Compute reactive flags for active highlighting and disabled
 *       gating (bold / italic, has-glyph, current cartouche variant,
 *       current rotation).
 *
 *  Free-form rotation and the cartouche variant picker live in
 *  popovers (RotatePopover, CartouchePopover) so the toolbar bar
 *  stays compact.
 * ------------------------------------------------------------------------ */

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import type { Mark } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CartouchePopover } from "./CartouchePopover";
import { ColorPopover } from "./ColorPopover";
import { RotatePopover } from "./RotatePopover";
import { ShadingPopover } from "./ShadingPopover";
import { ToolbarButton } from "./ToolbarButton";
import {
  CARTOUCHE_VARIANTS,
  detectCartouche,
  detectDamage,
  groupHorizontal,
  groupVertical,
  hasFormatControl,
  hasHieroSign,
  isGroupedHorizontally,
  isGroupedVertically,
  setCartouche,
  ungroup,
  type CartoucheVariant,
  type RangeCommand,
} from "../editor/commands";
import "./Toolbar.css";

interface IProps {
  editor: Editor | null;
  fontSize: number;
  setFontSize: (n: number) => void;
  direction: "ltr" | "rtl";
  setDirection: (d: "ltr" | "rtl") => void;
  verticalMode: boolean;
  setVerticalMode: (v: boolean) => void;
}

/** Run a pure-string command against the current selection.
 *  Returns whether a dispatch happened (false on empty selection,
 *  cross-paragraph selection, or a no-op command result). */
const runRangeCommand = (editor: Editor, cmd: RangeCommand): boolean => {
  const sel = editor.state.selection;
  const { $from, $to, from, to } = sel;
  if (from === to) return false;
  if ($from.parent !== $to.parent) return false;
  const text = editor.state.doc.textBetween(from, to, "");
  const result = cmd(text);
  if (!result) return false;
  const tr = editor.state.tr;
  tr.insertText(result.replacement, from, to);
  const newFrom = from + result.selFrom;
  const newTo = from + result.selTo;
  tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
};

/** Cartouche operations need to "see" the caps that wrap the
 *  selection. Without that, switching from royal → plain on the
 *  inner content would just nest plain inside royal. So we sniff the
 *  characters immediately around the selection and, if they match a
 *  known variant's open/close, fold them into the operation range. */
const runCartouche = (
  editor: Editor,
  variant: CartoucheVariant,
): boolean => {
  const sel = editor.state.selection;
  const { $from, $to, from, to } = sel;
  if (from === to) return false;
  if ($from.parent !== $to.parent) return false;
  const text = $from.parent.textContent;
  const offsetFrom = $from.parentOffset;
  const offsetTo = $to.parentOffset;
  let rangeFrom = from;
  let rangeTo = to;
  let selectedText = text.slice(offsetFrom, offsetTo);
  for (const v of CARTOUCHE_VARIANTS) {
    const beforeStart = offsetFrom - v.open.length;
    const afterEnd = offsetTo + v.close.length;
    if (
      beforeStart >= 0 &&
      afterEnd <= text.length &&
      text.slice(beforeStart, offsetFrom) === v.open &&
      text.slice(offsetTo, afterEnd) === v.close
    ) {
      rangeFrom = from - v.open.length;
      rangeTo = to + v.close.length;
      selectedText = text.slice(beforeStart, afterEnd);
      break;
    }
  }
  const result = setCartouche(variant)(selectedText);
  if (!result) return false;
  const tr = editor.state.tr;
  tr.insertText(result.replacement, rangeFrom, rangeTo);
  const newFrom = rangeFrom + result.selFrom;
  const newTo = rangeFrom + result.selTo;
  tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
};

/** Find the first instance of a Mark by name within `[from, to]`.
 *  Returns null if no character in the range carries it. Used by
 *  the toolbar's reactive selector to read the active rotation
 *  even when the selection's start position has no mark to its
 *  left (which `$from.marks()` would miss). */
const findMarkInRange = (
  ed: Editor,
  name: string,
  from: number,
  to: number,
): Mark | null => {
  let found: Mark | null = null;
  ed.state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    const m = node.marks.find((mm) => mm.type.name === name);
    if (m) found = m;
    return undefined;
  });
  return found;
};

export const Toolbar = ({
  editor,
  fontSize,
  setFontSize,
  direction,
  setDirection,
  verticalMode,
  setVerticalMode,
}: IProps) => {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor;
      if (!ed) return null;
      const sel = ed.state.selection;
      const { from, to, $from, $to } = sel;
      const empty = from === to;
      const text = empty ? "" : ed.state.doc.textBetween(from, to, "");

      // For an empty selection, the active mark is whatever the next
      // typed character would inherit (storedMarks, falling back to
      // marks-before-position). For a non-empty selection we have
      // to scan the range — `$from.marks()` looks LEFT of the start
      // position, which misses marks that begin AT the selection
      // start (the common case after a click-drag).
      const rotMark = empty
        ? (ed.state.storedMarks ?? $from.marks()).find(
            (m) => m.type.name === "hieroRotation",
          )
        : findMarkInRange(ed, "hieroRotation", from, to);

      const colorMark = empty
        ? (ed.state.storedMarks ?? $from.marks()).find(
            (m) => m.type.name === "hieroColor",
          )
        : findMarkInRange(ed, "hieroColor", from, to);

      // Cartouche detection looks both at the selection itself AND
      // at the chars immediately around it, so a selection on a
      // cartouche's INNER content still reads as "wrapped".
      let cartouche: CartoucheVariant | null = empty
        ? null
        : detectCartouche(text);
      if (!cartouche && !empty && $from.parent === $to.parent) {
        const paragraphText = $from.parent.textContent;
        const offsetFrom = $from.parentOffset;
        const offsetTo = $to.parentOffset;
        for (const v of CARTOUCHE_VARIANTS) {
          const beforeStart = offsetFrom - v.open.length;
          const afterEnd = offsetTo + v.close.length;
          if (
            beforeStart >= 0 &&
            afterEnd <= paragraphText.length &&
            paragraphText.slice(beforeStart, offsetFrom) === v.open &&
            paragraphText.slice(offsetTo, afterEnd) === v.close
          ) {
            cartouche = v;
            break;
          }
        }
      }

      return {
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        canBold: ed.can().toggleBold(),
        canItalic: ed.can().toggleItalic(),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        empty,
        hasHiero: hasHieroSign(text),
        hasFormat: hasFormatControl(text),
        cartouche,
        isGrV: isGroupedVertically(text),
        isGrH: isGroupedHorizontally(text),
        rotation: rotMark ? Number(rotMark.attrs.degrees) || 0 : 0,
        color: colorMark
          ? (typeof colorMark.attrs.color === "string"
              ? colorMark.attrs.color
              : null)
          : null,
        damage: empty ? null : detectDamage(text),
      };
    },
  });

  if (!editor || !state) {
    return <div className="toolbar toolbar--placeholder" />;
  }

  const run = (fn: () => void) => () => fn();

  const applyCartouche = (variant: CartoucheVariant) => {
    runCartouche(editor, variant);
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor toolbar">
      <div className="toolbar__group">
        <ToolbarButton
          disabled={!state.canUndo}
          title="Undo (Ctrl+Z)"
          onClick={run(() => editor.chain().focus().undo().run())}
        >
          Undo
        </ToolbarButton>
        <ToolbarButton
          disabled={!state.canRedo}
          title="Redo (Ctrl+Shift+Z)"
          onClick={run(() => editor.chain().focus().redo().run())}
        >
          Redo
        </ToolbarButton>
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group">
        <ToolbarButton
          active={state.bold}
          disabled={!state.canBold}
          title="Bold (Ctrl+B)"
          onClick={run(() => editor.chain().focus().toggleBold().run())}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={state.italic}
          disabled={!state.canItalic}
          title="Italic (Ctrl+I)"
          onClick={run(() => editor.chain().focus().toggleItalic().run())}
        >
          <em>I</em>
        </ToolbarButton>
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group">
        <ToolbarButton
          active={direction === "ltr"}
          title="Left-to-right"
          onClick={run(() => setDirection("ltr"))}
        >
          LTR
        </ToolbarButton>
        <ToolbarButton
          active={direction === "rtl"}
          title="Right-to-left"
          onClick={run(() => setDirection("rtl"))}
        >
          RTL
        </ToolbarButton>
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group toolbar__group--size">
        <label className="toolbar__label" htmlFor="font-size">
          Size
        </label>
        <input
          id="font-size"
          type="range"
          min={14}
          max={64}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
        />
        <span className="toolbar__value">{fontSize}px</span>
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group">
        <ToolbarButton
          active={state.isGrV}
          disabled={state.empty || !state.hasHiero}
          title="Stack selected glyphs vertically (quadrat)"
          onClick={run(() => runRangeCommand(editor, groupVertical))}
        >
          Group V
        </ToolbarButton>
        <ToolbarButton
          active={state.isGrH}
          disabled={state.empty || !state.hasHiero}
          title="Place selected glyphs horizontally"
          onClick={run(() => runRangeCommand(editor, groupHorizontal))}
        >
          Group H
        </ToolbarButton>
        <ToolbarButton
          disabled={state.empty || !state.hasFormat}
          title="Remove grouping format-controls from the selection"
          onClick={run(() => runRangeCommand(editor, ungroup))}
        >
          Ungroup
        </ToolbarButton>
        <CartouchePopover
          currentVariant={state.cartouche}
          applyVariant={applyCartouche}
          disabled={state.empty}
        />
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group">
        <RotatePopover
          editor={editor}
          rotation={state.rotation}
          disabled={state.empty || !state.hasHiero}
        />
        <ShadingPopover
          editor={editor}
          damage={state.damage}
          hasHiero={state.hasHiero}
          disabled={state.empty || !state.hasHiero}
        />
        <ColorPopover
          editor={editor}
          color={state.color}
          disabled={state.empty}
        />
      </div>

      <span className="toolbar__sep" />

      <div className="toolbar__group">
        <ToolbarButton
          active={verticalMode}
          title="Render preview vertically (whole document)"
          onClick={run(() => setVerticalMode(!verticalMode))}
        >
          Vertical Preview
        </ToolbarButton>
      </div>
    </div>
  );
};
