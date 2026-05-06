import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Download,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  X,
} from "lucide-react";

export interface MagicBoxIcon {
  id: string;
  html: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  flipX: boolean;
  flipY: boolean;
  baseWidth: number;
  baseHeight: number;
}

interface MagicBoxProps {
  icons: Element[];
  iconSize: number;
  /** When true (editor column mode), combination width = iconSize; height capped at 90px. */
  columnMode?: boolean;
  onClose: () => void;
  onInsert: (compositeHtml: string, width: number, height: number) => void;
}

const WORKSPACE_W = 500;
const WORKSPACE_H = 400;
const ICON_GAP = 8;
const BOX_SIZE = 320;
const BOX_TOP_OFFSET = 24;
const ICON_STRIP_TOP = 8;
const ICON_STRIP_HEIGHT = 56;

type DragMode =
  | {
      type: "move";
      iconId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      type: "resize";
      iconId: string;
      startX: number;
      startY: number;
      origScale: number;
      startDist: number;
    }
  | {
      type: "rotate";
      iconId: string;
      centerX: number;
      centerY: number;
      origRotation: number;
      startAngle: number;
    }
  | null;

export default function MagicBox({
  icons: sourceIcons,
  iconSize,
  columnMode = false,
  onClose,
  onInsert,
}: MagicBoxProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [icons, setIcons] = useState<MagicBoxIcon[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<DragMode>(null);
  const [isIconNearBox, setIsIconNearBox] = useState(false);
  const MAGNETIC_THRESHOLD = 20;
  const [, forceRender] = useState(0);
  const initialIconsRef = useRef<MagicBoxIcon[]>([]);

  const boxWidth = BOX_SIZE;
  const boxHeight = BOX_SIZE;
  const boxLeft = (WORKSPACE_W - boxWidth) / 2;
  const boxTop = (WORKSPACE_H - boxHeight) / 2 + BOX_TOP_OFFSET;

  useEffect(() => {
    const dims: Array<{ w: number; h: number }> = [];
    sourceIcons.forEach((icon) => {
      const el = icon as HTMLElement;
      const clone = el.cloneNode(true) as HTMLElement;
      const isMerged = el.classList.contains("merged");
      let sourceW: number, sourceH: number;
      if (isMerged) {
        const rect = el.getBoundingClientRect();
        sourceW = rect.width || parseFloat(el.style.width) || 39;
        sourceH = rect.height || parseFloat(el.style.height) || 39;
      } else {
        const svg = clone.querySelector("svg");
        sourceW = svg ? parseFloat(svg.style.width) || 39 : 39;
        sourceH = svg ? parseFloat(svg.style.height) || 39 : 39;
      }
      const safeW = sourceW > 0 ? sourceW : 39;
      const safeH = sourceH > 0 ? sourceH : 39;
      dims.push({ w: safeW, h: safeH });
    });

    const rowWidth =
      dims.reduce((acc, d) => acc + d.w, 0) + (dims.length - 1) * ICON_GAP;
    const startX = (WORKSPACE_W - rowWidth) / 2;
    const maxH = Math.max(...dims.map((d) => d.h), 20);
    const startY = ICON_STRIP_TOP + (ICON_STRIP_HEIGHT - maxH) / 2;

    const items: MagicBoxIcon[] = sourceIcons.map((icon, i) => {
      const el = icon as HTMLElement;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.backgroundColor = "";
      clone.style.outline = "";

      const { w, h } = dims[i];
      let x = startX;
      for (let j = 0; j < i; j++) x += dims[j].w + ICON_GAP;
      const y = startY + (maxH - h) / 2;

      return {
        id: el.dataset.id || `mb-${i}`,
        html: clone.innerHTML,
        x,
        y,
        rotation: 0,
        scale: 1,
        flipX: false,
        flipY: false,
        baseWidth: w,
        baseHeight: h,
      };
    });
    initialIconsRef.current = items.map((ic) => ({ ...ic }));
    setIcons(items);
  }, [sourceIcons]);

  const updateIcon = useCallback((id: string, patch: Partial<MagicBoxIcon>) => {
    setIcons((prev) =>
      prev.map((ic) => (ic.id === id ? { ...ic, ...patch } : ic)),
    );
  }, []);

  const onPointerDown = useCallback(
    (
      e: React.PointerEvent,
      iconId: string,
      mode: "move" | "resize" | "rotate",
    ) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setSelectedId(iconId);

      const icon = icons.find((ic) => ic.id === iconId);
      if (!icon) return;

      if (mode === "move") {
        dragRef.current = {
          type: "move",
          iconId,
          startX: e.clientX,
          startY: e.clientY,
          origX: icon.x,
          origY: icon.y,
        };
      } else if (mode === "resize") {
        const ws = workspaceRef.current;
        if (!ws) return;
        const rect = ws.getBoundingClientRect();
        const cx = rect.left + icon.x + icon.baseWidth / 2;
        const cy = rect.top + icon.y + icon.baseHeight / 2;
        const startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
        dragRef.current = {
          type: "resize",
          iconId,
          startX: cx,
          startY: cy,
          origScale: icon.scale,
          startDist: Math.max(startDist, 1),
        };
      } else if (mode === "rotate") {
        const ws = workspaceRef.current;
        if (!ws) return;
        const rect = ws.getBoundingClientRect();
        const cx = rect.left + icon.x + icon.baseWidth / 2;
        const cy = rect.top + icon.y + icon.baseHeight / 2;
        const startAngle =
          Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        dragRef.current = {
          type: "rotate",
          iconId,
          centerX: cx,
          centerY: cy,
          origRotation: icon.rotation,
          startAngle,
        };
      }
    },
    [icons],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === "move") {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const newX = drag.origX + dx;
        const newY = drag.origY + dy;
        updateIcon(drag.iconId, { x: newX, y: newY });
        const icon = icons.find((ic) => ic.id === drag.iconId);
        if (icon) {
          const scaledW = icon.baseWidth * icon.scale;
          const scaledH = icon.baseHeight * icon.scale;
          const visualLeft = newX - (scaledW - icon.baseWidth) / 2;
          const visualTop = newY - (scaledH - icon.baseHeight) / 2;
          const visualRight = visualLeft + scaledW;
          const visualBottom = visualTop + scaledH;
          const boxRight = boxLeft + boxWidth;
          const boxBottom = boxTop + boxHeight;
          const near =
            visualRight >= boxLeft - MAGNETIC_THRESHOLD &&
            visualLeft <= boxRight + MAGNETIC_THRESHOLD &&
            visualBottom >= boxTop - MAGNETIC_THRESHOLD &&
            visualTop <= boxBottom + MAGNETIC_THRESHOLD;
          setIsIconNearBox(near);
        }
      } else if (drag.type === "resize") {
        const icon = icons.find((ic) => ic.id === drag.iconId);
        if (!icon) return;
        const currentDist = Math.hypot(
          e.clientX - drag.startX,
          e.clientY - drag.startY,
        );
        const ratio = currentDist / drag.startDist;
        const rawScale = drag.origScale * ratio;
        const maxScaleByHeight = icon.baseHeight > 0 ? 90 / icon.baseHeight : 5;
        const newScale = Math.max(0.15, Math.min(maxScaleByHeight, rawScale));
        updateIcon(drag.iconId, { scale: newScale });
      } else if (drag.type === "rotate") {
        const angle =
          Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX) *
          (180 / Math.PI);
        const delta = angle - drag.startAngle;
        updateIcon(drag.iconId, { rotation: drag.origRotation + delta });
      }
    },
    [updateIcon, icons, boxLeft, boxTop, boxWidth, boxHeight],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.type === "move") {
      const icon = icons.find((ic) => ic.id === drag.iconId);
      if (icon) {
        const scaledW = icon.baseWidth * icon.scale;
        const scaledH = icon.baseHeight * icon.scale;
        const visualLeft = icon.x - (scaledW - icon.baseWidth) / 2;
        const visualTop = icon.y - (scaledH - icon.baseHeight) / 2;
        const visualRight = visualLeft + scaledW;
        const visualBottom = visualTop + scaledH;

        const boxRight = boxLeft + boxWidth;
        const boxBottom = boxTop + boxHeight;

        // Magnetic zone: expand box by 20px in all directions.
        const threshold = 20;
        const nearBox =
          visualRight >= boxLeft - threshold &&
          visualLeft <= boxRight + threshold &&
          visualBottom >= boxTop - threshold &&
          visualTop <= boxBottom + threshold;

        if (nearBox) {
          // Snap fully inside the box.
          let snappedLeft = visualLeft;
          let snappedTop = visualTop;
          snappedLeft = Math.max(
            boxLeft,
            Math.min(snappedLeft, boxRight - scaledW),
          );
          snappedTop = Math.max(
            boxTop,
            Math.min(snappedTop, boxBottom - scaledH),
          );
          const newX = snappedLeft + (scaledW - icon.baseWidth) / 2;
          const newY = snappedTop + (scaledH - icon.baseHeight) / 2;
          updateIcon(drag.iconId, { x: newX, y: newY });
        }
        // If not near box, leave icon exactly where user dropped it.
      }
    }
    dragRef.current = null;
    setIsIconNearBox(false);
    forceRender((n) => n + 1);
  }, [icons, boxLeft, boxTop, boxWidth, boxHeight, updateIcon]);

  const resetTransforms = () => {
    setIcons(initialIconsRef.current.map((ic) => ({ ...ic })));
    setSelectedId(null);
  };

  const allIconsInsideBox = (() => {
    for (const ic of icons) {
      const scaledW = ic.baseWidth * ic.scale;
      const scaledH = ic.baseHeight * ic.scale;
      const visualLeft = ic.x - (scaledW - ic.baseWidth) / 2;
      const visualTop = ic.y - (scaledH - ic.baseHeight) / 2;
      const visualRight = visualLeft + scaledW;
      const visualBottom = visualTop + scaledH;
      if (
        visualLeft < boxLeft ||
        visualTop < boxTop ||
        visualRight > boxLeft + boxWidth ||
        visualBottom > boxTop + boxHeight
      ) {
        return false;
      }
    }
    return icons.length > 0;
  })();

  const toggleFlipX = (id: string) => {
    setIcons((prev) =>
      prev.map((ic) => (ic.id === id ? { ...ic, flipX: !ic.flipX } : ic)),
    );
  };

  const toggleFlipY = (id: string) => {
    setIcons((prev) =>
      prev.map((ic) => (ic.id === id ? { ...ic, flipY: !ic.flipY } : ic)),
    );
  };

  const handleInsert = () => {
    if (icons.length === 0 || !allIconsInsideBox) return;

    let globalMinX = Infinity,
      globalMinY = Infinity,
      globalMaxX = -Infinity,
      globalMaxY = -Infinity;

    const iconCenters: Array<{ cx: number; cy: number }> = [];

    for (const ic of icons) {
      const scaledW = ic.baseWidth * ic.scale;
      const scaledH = ic.baseHeight * ic.scale;
      const cssLeft = ic.x - (scaledW - ic.baseWidth) / 2;
      const cssTop = ic.y - (scaledH - ic.baseHeight) / 2;
      const cx = cssLeft + ic.baseWidth / 2;
      const cy = cssTop + ic.baseHeight / 2;
      iconCenters.push({ cx, cy });

      const hw = scaledW / 2;
      const hh = scaledH / 2;
      const rad = (ic.rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      for (const [px, py] of [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ] as [number, number][]) {
        const rx = px * cosR - py * sinR + cx;
        const ry = px * sinR + py * cosR + cy;
        globalMinX = Math.min(globalMinX, rx);
        globalMinY = Math.min(globalMinY, ry);
        globalMaxX = Math.max(globalMaxX, rx);
        globalMaxY = Math.max(globalMaxY, ry);
      }
    }

    const rawW = globalMaxX - globalMinX;
    const rawH = globalMaxY - globalMinY;

    const insertTarget = Math.max(12, iconSize);
    const maxComboW = Math.min(90, insertTarget);
    let scaleFactor: number;
    let totalW: number;
    let totalH: number;

    if (columnMode) {
      scaleFactor = rawW > 0 ? maxComboW / rawW : 1;
      totalW = maxComboW;
      totalH = rawH * scaleFactor;
      if (totalH > 90) {
        const hScale = 90 / totalH;
        scaleFactor *= hScale;
        totalH = 90;
        totalW = Math.min(Math.round(totalW * hScale), maxComboW);
      }
      totalW = Math.round(totalW);
      totalH = Math.round(totalH);
    } else {
      const scaleByW = rawW > 0 ? maxComboW / rawW : 1;
      const scaleByH = rawH > 0 ? insertTarget / rawH : 1;
      scaleFactor = Math.min(scaleByW, scaleByH);
      totalW = Math.round(rawW * scaleFactor);
      totalH = Math.round(rawH * scaleFactor);
    }

    let innerHtml = "";
    for (let i = 0; i < icons.length; i++) {
      const ic = icons[i];
      const { cx, cy } = iconCenters[i];
      const outCx = (cx - globalMinX) * scaleFactor;
      const outCy = (cy - globalMinY) * scaleFactor;
      const combinedScale = ic.scale * scaleFactor;
      const flipStr =
        (ic.flipX ? " scaleX(-1)" : "") + (ic.flipY ? " scaleY(-1)" : "");
      const transform = `scale(${combinedScale}) rotate(${ic.rotation}deg)${flipStr}`;
      const left = outCx - ic.baseWidth / 2;
      const top = outCy - ic.baseHeight / 2;
      innerHtml += `<span style="position:absolute;left:${left}px;top:${top}px;width:${ic.baseWidth}px;height:${ic.baseHeight}px;transform:${transform};transform-origin:center center;display:inline-block;overflow:visible;">${ic.html}</span>`;
    }

    onInsert(innerHtml, totalW, totalH);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 0,
          width: "min(90vw, 620px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "linear-gradient(135deg, #FAE5C8, #f5d5a8)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>&#x2728;</span>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#374151",
              }}
            >
              Edit Group
            </h3>
            <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 4 }}>
              {icons.length} icon{icons.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "#6b7280",
              borderRadius: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tip bar */}
        <div
          style={{
            padding: "8px 20px",
            fontSize: 12,
            color: "#6b7280",
            background: "#f9fafb",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          Drag icons into the box—they snap inside on drop. Resize icons when
          selected. Insert is enabled when every icon is inside.
        </div>

        {/* Workspace */}
        <div
          style={{
            padding: 20,
            flex: 1,
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            ref={workspaceRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => setSelectedId(null)}
            style={{
              position: "relative",
              width: WORKSPACE_W,
              height: WORKSPACE_H,
              border: "2px dashed #d1d5db",
              borderRadius: 12,
              background: "#ffffff",
              overflow: "hidden",
              touchAction: "none",
            }}
          >
            {/* Drop box: fixed 320×320, dashed when icon is within magnetic zone */}
            <div
              style={{
                position: "absolute",
                left: boxLeft,
                top: boxTop,
                width: boxWidth,
                height: boxHeight,
                border: isIconNearBox
                  ? "3px dashed #a67c52"
                  : "3px solid #ccaa83",
                borderRadius: 8,
                background: isIconNearBox
                  ? "rgba(250, 229, 200, 0.5)"
                  : "rgba(250, 229, 200, 0.3)",
                boxSizing: "border-box",
                pointerEvents: "none",
                transition: "border 0.15s ease, background 0.15s ease",
              }}
            />
            {icons.map((ic) => {
              const isSelected = ic.id === selectedId;
              const scaledW = ic.baseWidth * ic.scale;
              const scaledH = ic.baseHeight * ic.scale;
              const offsetX = (scaledW - ic.baseWidth) / 2;
              const offsetY = (scaledH - ic.baseHeight) / 2;

              const flipTf =
                (ic.flipX ? " scaleX(-1)" : "") +
                (ic.flipY ? " scaleY(-1)" : "");

              return (
                <div
                  key={ic.id}
                  style={{
                    position: "absolute",
                    left: ic.x - offsetX,
                    top: ic.y - offsetY,
                    width: ic.baseWidth,
                    height: ic.baseHeight,
                    transform: `scale(${ic.scale}) rotate(${ic.rotation}deg)${flipTf}`,
                    transformOrigin: "center center",
                    cursor: "grab",
                    outline: isSelected
                      ? `${2 / ic.scale}px solid #3b82f6`
                      : "none",
                    outlineOffset: 3 / ic.scale,
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPointerDown(e, ic.id, "move");
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(ic.id);
                  }}
                >
                  {/* Icon content — SVG scales naturally via CSS transform */}
                  <div
                    style={{
                      width: ic.baseWidth,
                      height: ic.baseHeight,
                      pointerEvents: "none",
                      overflow: "visible",
                    }}
                    dangerouslySetInnerHTML={{ __html: ic.html }}
                  />

                  {/* Control handles shown on selection */}
                  {isSelected && (
                    <>
                      {/* Resize handle (bottom-right corner) */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDown(e, ic.id, "resize");
                        }}
                        style={{
                          position: "absolute",
                          right: -6 / ic.scale,
                          bottom: -6 / ic.scale,
                          width: 12 / ic.scale,
                          height: 12 / ic.scale,
                          background: "#3b82f6",
                          border: `${2 / ic.scale}px solid white`,
                          borderRadius: 2 / ic.scale,
                          cursor: "nwse-resize",
                          zIndex: 20,
                        }}
                      />
                      {/* Rotate handle (top center) */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDown(e, ic.id, "rotate");
                        }}
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: -24 / ic.scale,
                          transform: "translateX(-50%)",
                          width: 14 / ic.scale,
                          height: 14 / ic.scale,
                          background: "#10b981",
                          border: `${2 / ic.scale}px solid white`,
                          borderRadius: "50%",
                          cursor: "grab",
                          zIndex: 20,
                        }}
                      />
                      {/* Rotation line */}
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: -12 / ic.scale,
                          width: 1 / ic.scale,
                          height: 12 / ic.scale,
                          background: "#10b981",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Flip buttons (left side) */}
                      <div
                        style={{
                          position: "absolute",
                          left: -28 / ic.scale,
                          top: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4 / ic.scale,
                          zIndex: 20,
                          transform: `scale(${1 / ic.scale})`,
                          transformOrigin: "top right",
                        }}
                      >
                        <button
                          title="Flip Horizontal"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFlipX(ic.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            width: 22,
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: ic.flipX ? "#8b5cf6" : "#f3f4f6",
                            color: ic.flipX ? "white" : "#374151",
                            border: `1px solid ${ic.flipX ? "#8b5cf6" : "#d1d5db"}`,
                            borderRadius: 4,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <FlipHorizontal2 size={14} />
                        </button>
                        <button
                          title="Flip Vertical"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFlipY(ic.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{
                            width: 22,
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: ic.flipY ? "#8b5cf6" : "#f3f4f6",
                            color: ic.flipY ? "white" : "#374151",
                            border: `1px solid ${ic.flipY ? "#8b5cf6" : "#d1d5db"}`,
                            borderRadius: 4,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <FlipVertical2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <button
            onClick={resetTransforms}
            title="Reset rotations and scales"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              color: "#374151",
            }}
          >
            <RotateCcw size={15} />
            Reset
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!allIconsInsideBox && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Place all icons inside the box to enable Insert
              </span>
            )}
            <button
              onClick={handleInsert}
              disabled={!allIconsInsideBox}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                background: allIconsInsideBox ? "#ccaa83" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: allIconsInsideBox ? "pointer" : "not-allowed",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Download size={15} />
              Insert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
