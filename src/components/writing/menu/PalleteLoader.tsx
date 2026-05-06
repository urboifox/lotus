import { InlineSvg } from "@/config/InlineSvg";
import React from "react";

function PaletteItem({
  id,
  picture_URL,
  pictureSize = 100,
  insertSvgAtCursor,
  handlePaletteDragStart,
  handlePaletteDragEnd,
  onSelect,
  canEdit = true,
}: {
  id: string | number;
  picture_URL: string;
  pictureSize?: number;
  insertSvgAtCursor: (svgString: string, pictureSize?: number) => void;
  handlePaletteDragStart: (svgString: string, e: React.DragEvent) => void;
  handlePaletteDragEnd: (e: React.DragEvent) => void;
  onSelect?: (id: string | number, rawSvg: string) => void;
  canEdit?: boolean;
}) {
  const [rawSvg, setRawSvg] = React.useState<string | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const clickTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressTriggeredRef = React.useRef(false);

  const [showPopup, setShowPopup] = React.useState(false);
  const [flipH, setFlipH] = React.useState(false);
  const [flipV, setFlipV] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setLoadFailed(false);
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, [picture_URL]);

  const applyTransformToSvg = (svgHtml: string): string => {
    if (!flipH && !flipV && rotation === 0) return svgHtml;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgHtml, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgHtml;

    const viewBox = svg.getAttribute("viewBox");
    let vw = 100,
      vh = 100;
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length >= 4) {
        vw = parts[2] || 100;
        vh = parts[3] || 100;
      }
    }
    const cx = vw / 2;
    const cy = vh / 2;

    const transforms: string[] = [];
    if (rotation !== 0) transforms.push(`rotate(${rotation} ${cx} ${cy})`);
    if (flipH) transforms.push(`translate(${vw} 0) scale(-1 1)`);
    if (flipV) transforms.push(`translate(0 ${vh}) scale(1 -1)`);

    if (transforms.length > 0) {
      const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", transforms.join(" "));
      while (svg.firstChild) {
        g.appendChild(svg.firstChild);
      }
      svg.appendChild(g);
    }

    return new XMLSerializer().serializeToString(svg);
  };

  const getTransformedSvg = () => (rawSvg ? applyTransformToSvg(rawSvg) : "");

  const handleInsert = () => {
    if (!canEdit) return;
    const svg = getTransformedSvg();
    if (svg) insertSvgAtCursor(svg, pictureSize);
    setShowPopup(false);
  };

  const handleCopy = async () => {
    const transformed = getTransformedSvg();
    if (!transformed) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(transformed, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return;

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "39px";
      svg.style.height = "39px";
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);

      const size = 39;
      const scale = 10;
      const canvas = document.createElement("canvas");
      canvas.width = size * scale;
      canvas.height = size * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const blob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size * scale, size * scale);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("SVG render failed"));
        };
        img.src = url;
      });

      const pngDataUrl = canvas.toDataURL("image/png");
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      const iconId = Math.random().toString(36).substr(2, 9);
      const wrapperHtml = `<span class="svg-icon" contenteditable="false" draggable="false" data-id="${iconId}" data-base-size="39" style="display:inline-block;cursor:text;margin:4px 2px;vertical-align:middle;transform:none;">${svgString}</span>`;
      const encodedOriginal = btoa(unescape(encodeURIComponent(wrapperHtml)));
      const imgTag = `<img src="${pngDataUrl}" width="39" height="39" style="vertical-align:middle;display:inline-block;margin:4px 2px" />`;
      const clipboardHtml = `<span data-svg-editor-content="true" style="display:none">${encodedOriginal}</span>${imgTag}`;

      if (navigator.clipboard?.write && pngBlob) {
        const htmlBlob = new Blob([clipboardHtml], { type: "text/html" });
        const textBlob = new Blob([""], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "image/png": pngBlob,
            "text/plain": textBlob,
          }),
        ]);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const startLongPress = () => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      longPressTimerRef.current = null;
      setFlipH(false);
      setFlipV(false);
      setRotation(0);
      setCopied(false);
      setShowPopup(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const previewTransform = `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1}) rotate(${rotation}deg)`;

  const loader = (
    <div style={{ display: "none" }}>
      <InlineSvg
        fileName={picture_URL}
        onLoad={(svg) => setRawSvg(svg)}
        onError={() => setLoadFailed(true)}
        size={0}
      />
    </div>
  );

  if (loadFailed) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(id, "")}
        onKeyDown={(e) => e.key === "Enter" && onSelect?.(id, "")}
        style={{
          width: 50,
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "#9ca3af",
          textAlign: "center",
          backgroundColor: "#f3f4f6",
          borderRadius: 4,
          border: "1px solid #D8A8659C",
          cursor: "pointer",
          transition: "border-color 0.2s, transform 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#d8a865";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#D8A8659C";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        Photo not found
      </div>
    );
  }

  if (!rawSvg) {
    return loader;
  }

  return (
    <>
      <div
        key={id}
        draggable={canEdit}
        onDragStart={(e) => {
          if (!canEdit) {
            e.preventDefault();
            return;
          }
          cancelLongPress();
          handlePaletteDragStart(rawSvg, e);
        }}
        onDragEnd={handlePaletteDragEnd}
        onMouseDown={() => startLongPress()}
        onMouseUp={() => cancelLongPress()}
        onTouchStart={() => startLongPress()}
        onTouchEnd={() => cancelLongPress()}
        onTouchMove={() => cancelLongPress()}
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
          }
          clickTimerRef.current = setTimeout(() => {
            if (onSelect) onSelect(id, rawSvg);
          }, 0);
        }}
        onDoubleClick={() => {
          if (longPressTriggeredRef.current) return;
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }
          if (!canEdit) return;
          insertSvgAtCursor(rawSvg, pictureSize);
        }}
        style={{
          cursor: canEdit ? "grab" : "not-allowed",
          borderRadius: 4,
          width: 50,
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.2s, transform 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#d8a865";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          cancelLongPress();
          e.currentTarget.style.borderColor = "#D8A8659C";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <div
          style={{ width: 40, height: 40 }}
          dangerouslySetInnerHTML={{ __html: rawSvg }}
        />
        {loader}
      </div>

      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowPopup(false)}
        >
          <div
            data-transform-popup
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FBF2E6",
              borderRadius: 12,
              padding: 20,
              width: 280,
              border: "2px solid #D8A8659C",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            {/* Close button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15, color: "#5a4a3a" }}>
                Transform Icon
              </span>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  background: "none",
                  border: "1px solid #D8A8659C",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#A66B00",
                }}
              >
                ✕
              </button>
            </div>

            {/* Icon preview */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  backgroundColor: "#fff",
                  border: "2px solid #D8A8659C",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    transform: previewTransform,
                    transition: "transform 0.2s ease",
                  }}
                  dangerouslySetInnerHTML={{ __html: rawSvg }}
                />
              </div>
            </div>

            {/* Transform buttons */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 14,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setFlipH(!flipH)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: flipH ? "2px solid #ccaa83" : "1px solid #D8A8659C",
                  backgroundColor: flipH ? "#FAE5C8" : "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#5a4a3a",
                  transition: "all 0.15s",
                }}
              >
                ↔ Flip H
              </button>
              <button
                onClick={() => setFlipV(!flipV)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: flipV ? "2px solid #ccaa83" : "1px solid #D8A8659C",
                  backgroundColor: flipV ? "#FAE5C8" : "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#5a4a3a",
                  transition: "all 0.15s",
                }}
              >
                ↕ Flip V
              </button>
              <div>
                <button
                  onClick={() => setRotation((rotation - 20 + 360) % 360)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #D8A8659C",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#5a4a3a",
                    transition: "all 0.15s",
                  }}
                >
                  ⟲
                </button>
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setRotation(((val % 360) + 360) % 360);
                  }}
                  style={{
                    width: 52,
                    padding: "5px 4px",
                    borderRadius: 6,
                    border:
                      rotation !== 0
                        ? "2px solid #ccaa83"
                        : "1px solid #D8A8659C",
                    backgroundColor: rotation !== 0 ? "#FAE5C8" : "#fff",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#5a4a3a",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => setRotation((rotation + 20) % 360)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #D8A8659C",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#5a4a3a",
                    transition: "all 0.15s",
                  }}
                >
                  ⟳
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleInsert}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#ccaa83",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#b8975f")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#ccaa83")
                }
              >
                Insert
              </button>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: copied ? "2px solid #22c55e" : "2px solid #ccaa83",
                  backgroundColor: copied ? "#dcfce7" : "#fff",
                  color: copied ? "#16a34a" : "#ccaa83",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!copied)
                    e.currentTarget.style.backgroundColor = "#FAE5C8";
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.backgroundColor = "#fff";
                }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default PaletteItem;
