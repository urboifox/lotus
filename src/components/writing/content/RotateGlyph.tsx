import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

interface IProps {
  selectedIconCount: number;
  /**
   * Representative rotation (deg, 0..359) of the current selection. 0 if
   * nothing is selected, or if the selection mixes different rotations.
   */
  selectedIconRotation: number;
  /**
   * Apply `angle` (deg, 0..359) to every selected glyph independently.
   * `commit` controls history: pass `false` while a continuous gesture
   * (dial drag) is in progress so the entire drag collapses into a
   * single undo step on release.
   */
  onRotateSelection: (angle: number, options?: { commit?: boolean }) => void;
}

const PRESETS = [0, 90, 180, 270] as const;

/**
 * Toolbar control for rotating the currently-selected glyph(s).
 *
 * The button itself shows the rotate icon and lights up (toolbar-tan
 * active state) whenever the selection has a non-zero rotation. Clicking
 * it opens a small popover with three input modes:
 *
 *   1. A circular dial — drag the handle for free-form rotation. Snaps
 *      to 15° steps unless Shift is held. Live-previews on every move
 *      and commits a single history entry on release.
 *   2. Four quick preset buttons (0/90/180/270°). One-click commits.
 *   3. A numeric input (0..359°) for typed precision. Commits on Enter
 *      / blur.
 *
 * Visual is tuned to match the rest of the AssistantBar (#FAE5C8 base,
 * #ccaa83 accent). Carries `data-keep-selection` so clicking inside the
 * popover doesn't clear the editor selection it's about to modify.
 */
const RotateGlyph: React.FC<IProps> = ({
  selectedIconCount,
  selectedIconRotation,
  onRotateSelection,
}) => {
  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState(selectedIconRotation);
  // Mirror of the dial input field. Kept as string so an in-progress
  // edit (e.g. user has typed "1" en route to "180") doesn't snap.
  const [inputValue, setInputValue] = useState(String(selectedIconRotation));
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Tracks whether we're inside a continuous dial drag. While true,
  // every angle change applies visually but does NOT commit history.
  // On release we fire one final `commit: true` to seal the undo step.
  const draggingRef = useRef(false);

  const isActive = selectedIconRotation !== 0;
  const disabled = selectedIconCount < 1;

  // Sync local angle with external rotation when the popover (re)opens
  // or when the selection changes underneath us.
  useEffect(() => {
    setAngle(selectedIconRotation);
    setInputValue(String(selectedIconRotation));
  }, [selectedIconRotation, open]);

  // Close the popover when clicking outside, but ignore clicks within
  // the editor itself — the user may want to widen the selection without
  // losing the dial.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      // Clicks inside any [data-keep-selection] (toolbar, popover, the
      // editor) shouldn't dismiss us.
      if (
        t instanceof HTMLElement &&
        (t.closest('[contenteditable="true"]') ||
          t.closest("[data-rotate-popover]"))
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Esc closes the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-close when the user deselects everything — the dial has nothing
  // to operate on at that point and the disabled trigger button would
  // look out of place sitting under an open popover.
  useEffect(() => {
    if (open && selectedIconCount < 1) setOpen(false);
  }, [open, selectedIconCount]);

  // Convert a pointer position (clientX/Y) to an angle (0..360),
  // measured clockwise from "up" (12 o'clock) — which lines up with
  // the way SVG/CSS `rotate(N deg)` increases visually.
  const pointToAngle = useCallback(
    (clientX: number, clientY: number, snapping: boolean): number => {
      const dial = dialRef.current;
      if (!dial) return 0;
      const rect = dial.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // atan2 returns angle from +X axis CCW. We want angle from -Y
      // (12 o'clock) CW, so swap and offset.
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      if (snapping) {
        deg = Math.round(deg / 15) * 15;
        if (deg >= 360) deg -= 360;
      } else {
        deg = Math.round(deg);
      }
      return deg;
    },
    [],
  );

  const startDrag = (e: React.MouseEvent | React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const handlerMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = pointToAngle(ev.clientX, ev.clientY, !ev.shiftKey);
      setAngle(next);
      setInputValue(String(next));
      onRotateSelection(next, { commit: false });
    };
    const handlerUp = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      // Commit the final angle as a single history step.
      const final = pointToAngle(ev.clientX, ev.clientY, !ev.shiftKey);
      setAngle(final);
      setInputValue(String(final));
      onRotateSelection(final, { commit: true });
      document.removeEventListener("mousemove", handlerMove);
      document.removeEventListener("mouseup", handlerUp, true);
    };
    document.addEventListener("mousemove", handlerMove);
    document.addEventListener("mouseup", handlerUp, true);

    // Apply the initial mousedown position immediately as a preview.
    const initial = pointToAngle(
      (e as React.MouseEvent).clientX,
      (e as React.MouseEvent).clientY,
      !(e as React.MouseEvent).shiftKey,
    );
    setAngle(initial);
    setInputValue(String(initial));
    onRotateSelection(initial, { commit: false });
  };

  const applyPreset = (preset: number) => {
    setAngle(preset);
    setInputValue(String(preset));
    onRotateSelection(preset, { commit: true });
  };

  const commitInputValue = () => {
    const raw = inputValue.trim();
    if (raw === "") {
      setInputValue(String(angle));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setInputValue(String(angle));
      return;
    }
    let normalized = parsed % 360;
    if (normalized < 0) normalized += 360;
    normalized = Math.round(normalized);
    setAngle(normalized);
    setInputValue(String(normalized));
    onRotateSelection(normalized, { commit: true });
  };

  // Coordinates on the dial perimeter for the handle dot.
  const dialSize = 132;
  const handleR = (dialSize - 14) / 2; // inset slightly from the rim
  const handleX = dialSize / 2 + handleR * Math.sin((angle * Math.PI) / 180);
  const handleY = dialSize / 2 - handleR * Math.cos((angle * Math.PI) / 180);

  return (
    <div
      ref={wrapperRef}
      data-keep-selection
      data-rotate-popover
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={
          disabled
            ? "Select one or more glyphs to rotate"
            : "Rotate selected glyph(s)"
        }
        style={{
          padding: "4px 8px",
          backgroundColor: open
            ? "#ccaa83"
            : isActive
              ? "#ccaa83"
              : "transparent",
          color: open || isActive ? "white" : "#374151",
          border: `1px solid ${open || isActive ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 500,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <RotateCw className="w-4 h-4" />
        {isActive ? `${selectedIconRotation}°` : ""}
      </button>

      {open && (
        <div
          ref={popoverRef}
          data-rotate-popover
          onMouseDown={(e) => {
            // Don't let mousedown inside the popover bubble up and
            // collapse the editor selection we're about to modify.
            e.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 60,
            background: "#FAE5C8",
            border: "1px solid #D8A86585",
            borderRadius: 8,
            padding: 14,
            width: 244,
            boxShadow:
              "0 6px 20px rgba(120, 80, 30, 0.18), 0 1px 3px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontWeight: 600,
              fontSize: 13,
              color: "#5b4126",
            }}
          >
            <span>Rotate</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>
              {selectedIconCount > 1
                ? `${selectedIconCount} glyphs`
                : "1 glyph"}
            </span>
          </div>

          <div
            ref={dialRef}
            onMouseDown={startDrag}
            style={{
              position: "relative",
              width: dialSize,
              height: dialSize,
              alignSelf: "center",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at center, #fff 0%, #fbeed3 65%, #f3dbb1 100%)",
              border: "1px solid #d8a86585",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
              cursor: disabled ? "not-allowed" : "grab",
              userSelect: "none",
            }}
          >
            {/* Tick marks every 30°, with cardinals at 0/90/180/270. */}
            {Array.from({ length: 12 }).map((_, i) => {
              const tickAngle = i * 30;
              const isCardinal = tickAngle % 90 === 0;
              const len = isCardinal ? 8 : 4;
              const innerR = dialSize / 2 - 2 - len;
              const outerR = dialSize / 2 - 2;
              const a = (tickAngle * Math.PI) / 180;
              const x1 = dialSize / 2 + innerR * Math.sin(a);
              const y1 = dialSize / 2 - innerR * Math.cos(a);
              const x2 = dialSize / 2 + outerR * Math.sin(a);
              const y2 = dialSize / 2 - outerR * Math.cos(a);
              return (
                <svg
                  key={tickAngle}
                  width={dialSize}
                  height={dialSize}
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                  }}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCardinal ? "#7a5b32" : "#bd9968"}
                    strokeWidth={isCardinal ? 1.6 : 1}
                    strokeLinecap="round"
                  />
                </svg>
              );
            })}

            {/* Pointer line from centre to the handle. */}
            <svg
              width={dialSize}
              height={dialSize}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              <line
                x1={dialSize / 2}
                y1={dialSize / 2}
                x2={handleX}
                y2={handleY}
                stroke="#ccaa83"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cx={dialSize / 2} cy={dialSize / 2} r={3} fill="#7a5b32" />
            </svg>

            {/* Draggable handle. */}
            <div
              style={{
                position: "absolute",
                left: handleX - 8,
                top: handleY - 8,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#ccaa83",
                border: "2px solid white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                pointerEvents: "none",
              }}
            />

            {/* Big centred angle readout. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  marginTop: 22,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#5b4126",
                  background: "rgba(255,255,255,0.7)",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                {angle}°
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {PRESETS.map((preset) => {
              const active = angle === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={`Rotate to ${preset}°`}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    backgroundColor: active ? "#ccaa83" : "transparent",
                    color: active ? "white" : "#374151",
                    border: `1px solid ${active ? "#ccaa83" : "#d1d5db"}`,
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {preset}°
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <label
              htmlFor="rotate-input"
              style={{ fontSize: 12, color: "#5b4126" }}
            >
              Custom
            </label>
            <input
              id="rotate-input"
              data-keep-selection
              type="number"
              min={0}
              max={359}
              step={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitInputValue();
                }
              }}
              onBlur={commitInputValue}
              style={{
                flex: 1,
                padding: "3px 6px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontSize: 12,
                background: "white",
              }}
            />
            <span style={{ fontSize: 12, color: "#5b4126" }}>°</span>
            <button
              type="button"
              onClick={() => applyPreset(0)}
              title="Reset rotation"
              style={{
                padding: "3px 8px",
                background: "transparent",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ fontSize: 10.5, color: "#7a5b32", opacity: 0.8 }}>
            Tip: hold <kbd style={{ fontFamily: "inherit" }}>Shift</kbd> while
            dragging for free angle (no snap).
          </div>
        </div>
      )}
    </div>
  );
};

export default RotateGlyph;
