import React, { useEffect, useRef, useState } from "react";

/**
 * The set of cartouche frame shapes the editor can render procedurally
 * (i.e. drawn with raw SVG paths from W/H, no external art assets).
 *
 *   - "oval" : classic Egyptian cartouche — flat sides, semi-circular
 *               bezier loops at the ends, single perpendicular bar at
 *               the terminating end (the "shen" / name terminator).
 *
 * To add a new variant, extend this union and add a matching branch in
 * `buildCartoucheSvg` (MainContent.tsx) and a `ShapePreview` case here.
 */
export type CartoucheShape = "oval";

interface IProps {
  selectedIconCount: number;
  /**
   * Wrap the current selection in a cartouche of `shape`. Called once per
   * picker click; the picker itself does not track which shape was chosen
   * last (each wrap is an independent decision).
   */
  onCartoucheWrap: (shape: CartoucheShape) => void;
}

interface ShapeOption {
  id: CartoucheShape;
  label: string;
  description: string;
}

const OPTIONS: ShapeOption[] = [
  {
    id: "oval",
    label: "Oval",
    description: "Classic Egyptian cartouche.",
  },
];

/**
 * Renders a small SVG preview of the given shape. Mirrors the geometry of
 * `buildCartoucheSvg` in MainContent.tsx so the toolbar preview always
 * matches what gets rendered in the editor.
 */
const ShapePreview: React.FC<{ shape: CartoucheShape; size?: number }> = ({
  shape,
  size = 44,
}) => {
  const W = size * 1.4;
  const H = size;
  const stroke = "currentColor";
  const strokeProps = { fill: "none" as const, stroke, strokeWidth: 1 };
  const fineProps = { fill: "none" as const, stroke, strokeWidth: 0.6 };
  const fillProps = { fill: stroke, stroke: "none" as const };

  if (shape === "oval") {
    const pad = H * 0.0208;
    const curveAnchor = H * 0.4167;
    const ctrlExtend = H * 0.1181;
    const leftAnchorX = Math.min(curveAnchor, W / 2);
    const rightAnchorX = Math.max(W - curveAnchor, W / 2);
    const yTop = pad;
    const yBot = H - pad;
    const barX = W - Math.max(1, H * 0.03);
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path
          d={`M ${leftAnchorX} ${yTop} C ${-ctrlExtend} ${yTop} ${-ctrlExtend} ${yBot} ${leftAnchorX} ${yBot}`}
          {...strokeProps}
        />
        <path
          d={`M ${rightAnchorX} ${yTop} C ${W + ctrlExtend} ${yTop} ${W + ctrlExtend} ${yBot} ${rightAnchorX} ${yBot}`}
          {...strokeProps}
        />
        <path
          d={`M ${leftAnchorX} ${yTop} L ${rightAnchorX} ${yTop}`}
          {...strokeProps}
        />
        <path
          d={`M ${leftAnchorX} ${yBot} L ${rightAnchorX} ${yBot}`}
          {...strokeProps}
        />
        <path
          d={`M ${barX} ${yTop} L ${barX} ${yBot}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  if (shape === "hwt") {
    const capLen = Math.max(2, H * 0.12);
    const knot = Math.max(1.5, H * 0.18);
    const xLeft = 0.5;
    const xRight = W - 0.5;
    const yTop = 0.5;
    const yBot = H - 0.5;
    const xStartCap = capLen;
    const xEndCap = W - capLen;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={`M ${xStartCap} ${yTop} L ${xEndCap} ${yTop}`} {...strokeProps} />
        <path d={`M ${xStartCap} ${yBot} L ${xEndCap} ${yBot}`} {...strokeProps} />
        {/* Left cap */}
        <path d={`M ${xLeft} ${yTop} L ${xLeft} ${yBot}`} {...strokeProps} />
        <path d={`M ${xLeft} ${yTop} L ${xStartCap} ${yTop}`} {...strokeProps} />
        <path d={`M ${xLeft} ${yBot} L ${xStartCap} ${yBot}`} {...strokeProps} />
        <path
          d={`M ${xStartCap - knot} ${yBot} L ${xStartCap - knot} ${yBot - knot} L ${xStartCap} ${yBot - knot}`}
          {...strokeProps}
        />
        {/* Right cap */}
        <path d={`M ${xRight} ${yTop} L ${xRight} ${yBot}`} {...strokeProps} />
        <path d={`M ${xEndCap} ${yTop} L ${xRight} ${yTop}`} {...strokeProps} />
        <path d={`M ${xEndCap} ${yBot} L ${xRight} ${yBot}`} {...strokeProps} />
        <path
          d={`M ${xEndCap} ${yBot - knot} L ${xEndCap + knot} ${yBot - knot} L ${xEndCap + knot} ${yBot}`}
          {...strokeProps}
        />
      </svg>
    );
  }

  if (shape === "serekh") {
    const facadeLen = Math.max(8, H * 0.55);
    const hwtCapLen = Math.max(2, H * 0.12);
    const hwtKnot = Math.max(1.5, H * 0.18);
    const xLeft = 0.5;
    const xRight = W - 0.5;
    const yTop = 0.5;
    const yBot = H - 0.5;
    const xFacadeEnd = facadeLen;
    const xHwtStart = W - hwtCapLen;
    const dx = xFacadeEnd - xLeft;
    const dy = yBot - yTop;
    const c1x = xLeft + dx * 0.1;
    const c2x = xLeft + dx * 0.3;
    const c3x = xLeft + dx * 0.4;
    const recessX = xLeft + dx * 0.5;
    const recessSpan = xFacadeEnd - recessX;
    const recesses: React.ReactElement[] = [];
    for (let i = 1; i < 10; i += 3) {
      const y1 = yTop + 0.1 * dy * i;
      const y2 = yTop + 0.1 * dy * (i + 1);
      const y3 = yTop + 0.1 * dy * (i + 2);
      const innerX = recessX + 0.2 * recessSpan;
      recesses.push(
        <path
          key={`r${i}`}
          d={`M ${xFacadeEnd} ${y1} L ${recessX} ${y1} L ${recessX} ${y3} L ${xFacadeEnd} ${y3}`}
          {...fineProps}
        />,
        <path
          key={`r${i}i`}
          d={`M ${innerX} ${y2} L ${xFacadeEnd} ${y2}`}
          {...fineProps}
        />,
      );
    }
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Body */}
        <path d={`M ${xFacadeEnd} ${yTop} L ${xHwtStart} ${yTop}`} {...strokeProps} />
        <path d={`M ${xFacadeEnd} ${yBot} L ${xHwtStart} ${yBot}`} {...strokeProps} />
        {/* Palace facade (left) */}
        <path d={`M ${xLeft} ${yTop} L ${xLeft} ${yBot}`} {...strokeProps} />
        <path d={`M ${xLeft} ${yTop} L ${xFacadeEnd} ${yTop}`} {...strokeProps} />
        <path d={`M ${xLeft} ${yBot} L ${xFacadeEnd} ${yBot}`} {...strokeProps} />
        <path d={`M ${c1x} ${yTop} L ${c1x} ${yBot}`} {...strokeProps} />
        <path d={`M ${c2x} ${yTop} L ${c2x} ${yBot}`} {...fineProps} />
        <path d={`M ${c3x} ${yTop} L ${c3x} ${yBot}`} {...fineProps} />
        {recesses}
        {/* Hwt-style end cap (right) */}
        <path d={`M ${xRight} ${yTop} L ${xRight} ${yBot}`} {...strokeProps} />
        <path d={`M ${xHwtStart} ${yTop} L ${xRight} ${yTop}`} {...strokeProps} />
        <path d={`M ${xHwtStart} ${yBot} L ${xRight} ${yBot}`} {...strokeProps} />
        <path
          d={`M ${xHwtStart} ${yBot - hwtKnot} L ${xHwtStart + hwtKnot} ${yBot - hwtKnot} L ${xHwtStart + hwtKnot} ${yBot}`}
          {...strokeProps}
        />
      </svg>
    );
  }

  // Enclosure
  const bDepth = Math.max(1.5, H * 0.06);
  const bLength = Math.max(2, H * 0.1);
  const xLeft = bDepth;
  const xRight = W - bDepth;
  const yTop = bDepth;
  const yBot = H - bDepth;

  const intermediateRects: React.ReactElement[] = [];
  const placeBastions = (
    innerLen: number,
    onPlace: (offset: number, key: string) => React.ReactElement | null,
  ) => {
    if (innerLen <= 3 * bLength) return;
    const n = Math.floor((innerLen - 3 * bLength) / (2 * bLength));
    if (n <= 0) return;
    const skip = (innerLen - n * bLength) / (n + 1);
    for (let i = 0; i < n; i++) {
      const offset = skip * (i + 1) + bLength * i;
      const el = onPlace(offset, `${innerLen}-${i}`);
      if (el) intermediateRects.push(el);
    }
  };
  placeBastions(xRight - xLeft, (offset, key) => (
    <rect
      key={`top-${key}`}
      x={xLeft + offset}
      y={yTop - bDepth}
      width={bLength}
      height={bDepth}
      {...fillProps}
    />
  ));
  placeBastions(xRight - xLeft, (offset, key) => (
    <rect
      key={`bot-${key}`}
      x={xLeft + offset}
      y={yBot}
      width={bLength}
      height={bDepth}
      {...fillProps}
    />
  ));
  placeBastions(yBot - yTop, (offset, key) => (
    <rect
      key={`left-${key}`}
      x={xLeft - bDepth}
      y={yTop + offset}
      width={bDepth}
      height={bLength}
      {...fillProps}
    />
  ));
  placeBastions(yBot - yTop, (offset, key) => (
    <rect
      key={`right-${key}`}
      x={xRight}
      y={yTop + offset}
      width={bDepth}
      height={bLength}
      {...fillProps}
    />
  ));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect
        x={xLeft}
        y={yTop}
        width={Math.max(0, xRight - xLeft)}
        height={Math.max(0, yBot - yTop)}
        {...strokeProps}
      />
      {/* Corner bastions (L-shape, rendered as two rects each) */}
      <rect x={xLeft - bDepth} y={yTop - bDepth} width={bDepth} height={bDepth + bLength} {...fillProps} />
      <rect x={xLeft - bDepth} y={yTop - bDepth} width={bDepth + bLength} height={bDepth} {...fillProps} />
      <rect x={xRight} y={yTop - bDepth} width={bDepth} height={bDepth + bLength} {...fillProps} />
      <rect x={xRight - bLength} y={yTop - bDepth} width={bDepth + bLength} height={bDepth} {...fillProps} />
      <rect x={xLeft - bDepth} y={yBot - bLength} width={bDepth} height={bLength} {...fillProps} />
      <rect x={xLeft - bDepth} y={yBot} width={bDepth + bLength} height={bDepth} {...fillProps} />
      <rect x={xRight} y={yBot - bLength} width={bDepth} height={bLength} {...fillProps} />
      <rect x={xRight - bLength} y={yBot} width={bDepth + bLength} height={bDepth} {...fillProps} />
      {intermediateRects}
    </svg>
  );
};

const CartoucheButton: React.FC<{
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ active, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={
      disabled ? "Select one or more glyphs to wrap" : "Wrap in cartouche"
    }
    style={{
      padding: "4px 6px",
      backgroundColor: active ? "#ccaa83" : disabled ? "transparent" : "#d4a574",
      color: !disabled || active ? "white" : "#374151",
      border: `1px solid ${active ? "#ccaa83" : disabled ? "#d1d5db" : "#d4a574"}`,
      borderRadius: 4,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: disabled ? 0.55 : 1,
    }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="22"
      viewBox="0 0 15.75 18"
      style={{ display: "block" }}
    >
      <path
        d="M 7.5 0.375 C -2.125 0.375 -2.125 17.625 7.5 17.625"
        style={{
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.2,
        }}
      />
      <path
        d="M 15.1875 0.375 L 15.1875 17.625"
        style={{
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.2,
        }}
      />
      <path
        d="M 7.5 0.375 C 17.125 0.375 17.125 17.625 7.5 17.625"
        style={{
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.2,
        }}
      />
    </svg>
  </button>
);

/**
 * Toolbar control for wrapping the current selection in a cartouche of
 * a chosen shape. Click the button to open a popover, click a shape to
 * apply and close. Mirrors `RotateGlyph`'s open / outside-close / Esc /
 * deselect-auto-close behaviour so all popover-based controls feel the
 * same.
 */
const CartouchePicker: React.FC<IProps> = ({
  selectedIconCount,
  onCartoucheWrap,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const disabled = selectedIconCount < 1;

  // Close on outside click, but ignore clicks inside the editor or any
  // popover-class element so the user can refine their selection without
  // losing the picker.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      if (
        t instanceof HTMLElement &&
        (t.closest('[contenteditable="true"]') ||
          t.closest("[data-cartouche-popover]"))
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

  // Auto-close when the selection drops to zero — same UX as RotateGlyph.
  useEffect(() => {
    if (open && selectedIconCount < 1) setOpen(false);
  }, [open, selectedIconCount]);

  const pickShape = (shape: CartoucheShape) => {
    onCartoucheWrap(shape);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      data-keep-selection
      data-cartouche-popover
      style={{ position: "relative", display: "inline-block" }}
    >
      <CartoucheButton
        active={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          ref={popoverRef}
          data-cartouche-popover
          onMouseDown={(e) => {
            // Don't let mousedown inside the popover bubble up and drop
            // the editor selection we're about to wrap.
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
            <span>Cartouche shape</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>
              {selectedIconCount > 1
                ? `${selectedIconCount} glyphs`
                : "1 glyph"}
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
                onClick={() => pickShape(opt.id)}
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
                <ShapePreview shape={opt.id} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
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

export default CartouchePicker;
