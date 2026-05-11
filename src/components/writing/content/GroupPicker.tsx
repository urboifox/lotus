import React, { useEffect, useRef, useState } from "react";

/**
 * Group orientation modes, mirroring JSesh's two grouping commands.
 *
 *   - "vertical"   : stack glyphs on top of each other (quadrat in
 *                    horizontal lines, natural-stack in vertical lines).
 *   - "horizontal" : pack glyphs side-by-side regardless of the
 *                    surrounding line direction.
 */
export type GroupOrientation = "vertical" | "horizontal";

interface IProps {
  selectedIconCount: number;
  /**
   * Group the current selection with the chosen orientation. Called once
   * per picker click — the picker itself stays stateless about which
   * orientation was used last.
   */
  onGroup: (orientation: GroupOrientation) => void;
}

interface OrientationOption {
  id: GroupOrientation;
  label: string;
  description: string;
}

const OPTIONS: OrientationOption[] = [
  {
    id: "vertical",
    label: "Vertical",
    description:
      "Stack glyphs vertically. In horizontal lines this packs them into one quadrat; in vertical lines they sit directly below each other.",
  },
  {
    id: "horizontal",
    label: "Horizontal",
    description:
      "Pack glyphs side-by-side. Always reads left-to-right regardless of the surrounding line direction.",
  },
];

/**
 * Tiny SVG preview of the orientation: two stacked or side-by-side
 * placeholder rectangles. Keeps the picker self-contained — no need
 * to render real glyph artwork.
 */
const OrientationPreview: React.FC<{
  orientation: GroupOrientation;
  size?: number;
}> = ({ orientation, size = 44 }) => {
  const W = size;
  const H = size;
  const stroke = "currentColor";
  const slotProps = {
    fill: "currentColor",
    fillOpacity: 0.25,
    stroke,
    strokeWidth: 1,
  } as const;

  if (orientation === "vertical") {
    const slotH = (H - 6) / 2;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={4} y={2} width={W - 8} height={slotH} rx={3} {...slotProps} />
        <rect
          x={4}
          y={H - 2 - slotH}
          width={W - 8}
          height={slotH}
          rx={3}
          {...slotProps}
        />
      </svg>
    );
  }

  const slotW = (W - 6) / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect x={2} y={4} width={slotW} height={H - 8} rx={3} {...slotProps} />
      <rect
        x={W - 2 - slotW}
        y={4}
        width={slotW}
        height={H - 8}
        rx={3}
        {...slotProps}
      />
    </svg>
  );
};

const GroupButton: React.FC<{
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ active, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={
      disabled ? "Select 2+ glyphs to group them" : "Group selected glyphs"
    }
    style={{
      padding: "4px 8px",
      backgroundColor: active
        ? "#ccaa83"
        : disabled
          ? "transparent"
          : "#d4a574",
      color: !disabled || active ? "white" : "#374151",
      border: `1px solid ${
        active ? "#ccaa83" : disabled ? "#d1d5db" : "#d4a574"
      }`,
      borderRadius: 4,
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 500,
      fontSize: 12,
      opacity: disabled ? 0.55 : 1,
    }}
  >
    Group
  </button>
);

/**
 * Group-orientation picker. Mirrors `CartouchePicker` / `RotateGlyph`:
 * click the button to open a popover, click an orientation to apply
 * and close. Outside-click, Esc, and deselect all close the popover.
 */
const GroupPicker: React.FC<IProps> = ({ selectedIconCount, onGroup }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const disabled = selectedIconCount < 2;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      if (
        t instanceof HTMLElement &&
        (t.closest('[contenteditable="true"]') ||
          t.closest("[data-group-popover]"))
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && selectedIconCount < 2) setOpen(false);
  }, [open, selectedIconCount]);

  const pickOrientation = (orientation: GroupOrientation) => {
    onGroup(orientation);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      data-keep-selection
      data-group-popover
      style={{ position: "relative", display: "inline-block" }}
    >
      <GroupButton
        active={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          ref={popoverRef}
          data-group-popover
          onMouseDown={(e) => {
            // Don't let mousedown inside the popover bubble up and drop
            // the editor selection we're about to group.
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
            padding: 12,
            width: 260,
            boxShadow:
              "0 6px 20px rgba(120, 80, 30, 0.18), 0 1px 3px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
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
            <span>Group orientation</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>
              {selectedIconCount} glyphs
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pickOrientation(opt.id)}
                title={opt.description}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 6px",
                  background: "white",
                  border: "1px solid #d8a86585",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#5b4126",
                  transition: "transform 80ms ease, background 80ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "#fff6e3";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "white";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                <OrientationPreview orientation={opt.id} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupPicker;
