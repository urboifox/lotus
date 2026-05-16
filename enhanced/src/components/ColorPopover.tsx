/* --------------------------------------------------------------------------
 *  Color popover.
 *
 *  Trigger button shows a swatch of the current color (or a striped
 *  "no color" tile when the selection isn't colored). The popover
 *  hosts:
 *    - a preset palette inspired by traditional Egyptian inks
 *      (black, red, blue, green, gold, brown),
 *    - a free-form `<input type="color">` for arbitrary picks,
 *    - a "Clear" button that strips the color mark.
 *
 *  Like RotatePopover, every control runs the same TipTap command
 *  (`setHieroColor`), so a dragged free-form pick or a chained set of
 *  preset clicks collapse into a single undo step via TipTap's
 *  history extension.
 * ------------------------------------------------------------------------ */

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "./Popover";
import { ToolbarButton } from "./ToolbarButton";
import "./ColorPopover.css";

interface IProps {
  editor: Editor;
  /** The color currently carried by the selection (null = none). */
  color: string | null;
  disabled: boolean;
}

interface Preset {
  label: string;
  value: string;
}

/** Egyptology-flavoured palette. The hex values are deliberately
 *  desaturated so signs printed in them still read as "ink on
 *  papyrus" rather than as flat web colors. */
const PRESETS: readonly Preset[] = [
  { label: "Ink", value: "#1f2937" },
  { label: "Red", value: "#a93729" },
  { label: "Blue", value: "#1e5aa6" },
  { label: "Green", value: "#2d7a4b" },
  { label: "Gold", value: "#b8860b" },
  { label: "Brown", value: "#7a4f1d" },
];

/** Normalise any browser-emitted color string (the native picker
 *  always returns `#rrggbb`; presets are already hex) to lowercase
 *  for stable comparisons in the active-state logic. */
const norm = (s: string | null): string => (s ?? "").trim().toLowerCase();

export const ColorPopover = ({ editor, color, disabled }: IProps) => {
  // The native color input is uncontrolled-feeling (drag emits a
  // stream of `change` events). Mirror the current color into local
  // state so the input picks up external changes (e.g. clicking a
  // preset) without us having to remount it.
  const [pending, setPending] = useState<string>(color ?? PRESETS[0].value);
  const [lastSeen, setLastSeen] = useState<string | null>(color);
  if (lastSeen !== color) {
    setLastSeen(color);
    if (color) setPending(color);
  }

  const apply = (next: string | null) => {
    if (next) setPending(next);
    editor.chain().focus().setHieroColor(next).run();
  };

  const activeColor = norm(color);

  const renderPanel = () => (
    <div className="color-popover">
      <div className="color-popover__label">Color</div>
      <div className="color-popover__grid">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.value}
            className={[
              "color-popover__swatch",
              norm(p.value) === activeColor
                ? "color-popover__swatch--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ background: p.value }}
            title={p.label}
            aria-label={p.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(p.value)}
          />
        ))}
      </div>
      <div className="color-popover__custom">
        <label
          className="color-popover__custom-label"
          htmlFor="color-popover-input"
        >
          Custom
        </label>
        <input
          id="color-popover-input"
          className="color-popover__input"
          type="color"
          value={pending}
          onChange={(e) => apply(e.target.value)}
        />
        <span className="color-popover__hex" aria-hidden="true">
          {pending}
        </span>
      </div>
      <button
        type="button"
        className="color-popover__clear"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => apply(null)}
        disabled={!color}
      >
        Clear color
      </button>
    </div>
  );

  // Build the trigger swatch. When no color is set we paint a small
  // diagonal stripe so the user can tell the state apart from a
  // genuine "white" pick.
  const swatchStyle: React.CSSProperties = color
    ? { background: color }
    : {
        background:
          "repeating-linear-gradient(45deg, #d1d5db 0 4px, #ffffff 4px 8px)",
      };

  return (
    <Popover
      trigger={({ open, toggle }) => (
        <ToolbarButton
          active={!disabled && color != null}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Color selected text"
          onClick={toggle}
        >
          <span className="color-popover__trigger-swatch" style={swatchStyle} />
          <span>Color</span>
        </ToolbarButton>
      )}
    >
      {() => renderPanel()}
    </Popover>
  );
};
