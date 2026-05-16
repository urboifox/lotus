/* --------------------------------------------------------------------------
 *  Rotate popover.
 *
 *  Trigger button shows the current rotation. The popover hosts:
 *    - a numeric input (0..359, type-and-Enter / blur to commit),
 *    - a continuous slider (drag to commit live),
 *    - a row of preset chips at 45° intervals.
 *
 *  Every control runs the same TipTap command, so the editor's
 *  history extension can collapse a sweep into a single undo step
 *  (commands fired within ~500ms get batched).
 * ------------------------------------------------------------------------ */

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "./Popover";
import { ToolbarButton } from "./ToolbarButton";
import "./RotatePopover.css";

interface IProps {
  editor: Editor;
  rotation: number;
  disabled: boolean;
}

const PRESETS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const clampDeg = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n) % 360) + 360) % 360;
};

export const RotatePopover = ({ editor, rotation, disabled }: IProps) => {
  // The number input + slider need a controlled value the user can
  // tweak BEFORE we commit the change to the editor (e.g. while
  // typing into the number field). We mirror the external rotation
  // into local state and resync via the "render-time setState"
  // pattern any time the selection's rotation changes from outside.
  const [pending, setPending] = useState<number>(rotation);
  const [lastSeenRotation, setLastSeenRotation] = useState<number>(rotation);
  if (lastSeenRotation !== rotation) {
    setLastSeenRotation(rotation);
    setPending(rotation);
  }

  const apply = (deg: number) => {
    const clamped = clampDeg(deg);
    setPending(clamped);
    editor.chain().focus().setHieroRotation(clamped).run();
  };

  const renderPanel = () => (
    <div className="rotate-popover">
      <label className="rotate-popover__label" htmlFor="rotate-popover-num">
        Rotation
      </label>
      <div className="rotate-popover__inputs">
        <input
          id="rotate-popover-num"
          className="rotate-popover__num"
          type="number"
          min={0}
          max={359}
          step={1}
          value={pending}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setPending(v);
          }}
          onBlur={() => apply(pending)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              apply(pending);
              e.currentTarget.blur();
            }
          }}
        />
        <span className="rotate-popover__deg">°</span>
      </div>
      <input
        className="rotate-popover__slider"
        type="range"
        min={0}
        max={359}
        step={1}
        value={pending}
        onChange={(e) => apply(Number(e.target.value))}
      />
      <div className="rotate-popover__presets">
        {PRESETS.map((deg) => (
          <button
            type="button"
            key={deg}
            className={[
              "rotate-popover__preset",
              pending === deg ? "rotate-popover__preset--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => apply(deg)}
          >
            {deg}°
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      trigger={({ open, toggle }) => (
        <ToolbarButton
          active={!disabled && rotation !== 0}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Rotate selected glyphs"
          onClick={toggle}
        >
          Rotate {rotation}°
        </ToolbarButton>
      )}
    >
      {() => renderPanel()}
    </Popover>
  );
};
