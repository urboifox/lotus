import React, { useRef } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Eraser,
  Image,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Undo2,
} from "lucide-react";
import TextSize from "./TextSize";
import IconSize from "./IconSize";
import ShadingPatterns from "./ShadingPatterns";

interface IProps {
  handleTextCommand: (command: string, value?: string | null) => void;
  setDirection: (direction: "ltr" | "rtl") => void;
  direction: "ltr" | "rtl";
  toggleColumnMode: () => void;
  mergeGroup: () => void;
  selectedIconCount: number;
  textSize: number;
  setTextSize: (textSize: number) => void;
  iconSize: number;
  setIconSize: (iconSize: number) => void;
  // fontFamily: string;
  // setFontFamily: (fontFamily: string) => void;
  onImageSelected: (dataUrl: string) => void;
  onShadingClick?: () => void;
  onRemoveShadingClick?: () => void;
  showShadingButton?: boolean;
  iconHasShading?: boolean;
  onInsertFullShading?: (pattern: string) => void;
  onCartoucheWrap?: () => void;
  onMagicBox?: () => void;
  iconVerticalAlign?: "top" | "middle" | "bottom";
  onIconVerticalAlign?: (align: "top" | "middle" | "bottom") => void;
}
// Cartouche SVG icon component
const CartoucheIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="22"
    viewBox="0 0 15.75 18"
    style={{
      display: "block",
    }}
  >
    <path
      d="M 7.5 0.375 C -2.125 0.375 -2.125 17.625 7.5 17.625"
      style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }}
    />
    <path
      d="M 15.1875 0.375 L 15.1875 17.625"
      style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }}
    />
    <path
      d="M 7.5 0.375 C 17.125 0.375 17.125 17.625 7.5 17.625"
      style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }}
    />
  </svg>
);

const Assistant = ({
  handleTextCommand,
  setDirection,
  direction,
  toggleColumnMode,
  mergeGroup,
  selectedIconCount,
  textSize,
  setTextSize,
  iconSize,
  setIconSize,
  onImageSelected,
  onShadingClick,
  onRemoveShadingClick,
  showShadingButton = false,
  iconHasShading = false,
  onInsertFullShading,
  onCartoucheWrap,
  onMagicBox,
  iconVerticalAlign = "middle",
  onIconVerticalAlign,
}: IProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);
  const [isStrikethrough, setIsStrikethrough] = React.useState(false);
  const [isGlyphFont, setIsGlyphFont] = React.useState(false);
  const [isOrderedList, setIsOrderedList] = React.useState(false);
  const [isUnorderedList, setIsUnorderedList] = React.useState(false);
  const [textAlign, setTextAlign] = React.useState<
    "left" | "center" | "right" | "justify"
  >("left");
  const [showShadingModal, setShowShadingModal] = React.useState(false);
  const [textColor, setTextColor] = React.useState("#000000");
  // True when the caret / selection anchor sits inside a `.vertical-run`
  // span. Drives the Vertical Mode button's active state so it behaves
  // like Bold / Italic — reflecting the local context, not a global flag.
  const [isInVerticalRun, setIsInVerticalRun] = React.useState(false);

  // Read the current Selection and refresh every formatting-state flag
  // (bold, italic, vertical-run, list, alignment, font, etc). Called
  // from event listeners (click / keyup / selectionchange) and directly
  // from button handlers that mutate the selection — needed because
  // `selectionchange` is debounced in some browsers and may fire after
  // the click handler that triggered it has already returned.
  const refreshFromSelection = React.useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchorNode = sel.anchorNode;
    if (!anchorNode) return;

    const anchorEl =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode.parentElement;
    const editorElement = anchorEl?.closest('[contenteditable="true"]');
    if (!editorElement) return;

    try {
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
      setIsUnderline(document.queryCommandState("underline"));
      setIsStrikethrough(document.queryCommandState("strikeThrough"));
      setIsOrderedList(document.queryCommandState("insertOrderedList"));
      setIsUnorderedList(document.queryCommandState("insertUnorderedList"));

      const fontName = document.queryCommandValue("fontName") || "";
      setIsGlyphFont(fontName.toLowerCase().includes("glyphtrl"));

      if (document.queryCommandState("justifyCenter")) {
        setTextAlign("center");
      } else if (document.queryCommandState("justifyRight")) {
        setTextAlign("right");
      } else if (document.queryCommandState("justifyFull")) {
        setTextAlign("justify");
      } else {
        setTextAlign("left");
      }

      // Is the caret / selection anchor inside a `.vertical-run`?
      let inVertical = false;
      let node: Node | null = anchorNode;
      while (node && node !== editorElement) {
        if (
          node instanceof HTMLElement &&
          node.classList.contains("vertical-run")
        ) {
          inVertical = true;
          break;
        }
        node = node.parentNode;
      }
      setIsInVerticalRun(inVertical);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    const updateFromEditorEvent = (e: Event) => {
      const target = e.target as HTMLElement;
      const editorElement = target.closest('[contenteditable="true"]');
      if (!editorElement) return;
      refreshFromSelection();
    };

    document.addEventListener("click", updateFromEditorEvent as EventListener);
    document.addEventListener("keyup", updateFromEditorEvent as EventListener);
    document.addEventListener("selectionchange", refreshFromSelection);

    return () => {
      document.removeEventListener(
        "click",
        updateFromEditorEvent as EventListener,
      );
      document.removeEventListener(
        "keyup",
        updateFromEditorEvent as EventListener,
      );
      document.removeEventListener("selectionchange", refreshFromSelection);
    };
  }, [refreshFromSelection]);

  // Wrap the Vertical Mode button click so we explicitly refresh state
  // after `toggleColumnMode` runs. The toggle mutates DOM and re-sets
  // the selection programmatically; the resulting `selectionchange` is
  // sometimes debounced past the synchronous return of this handler, so
  // we also schedule a refresh on the next animation frame to guarantee
  // the button's active state catches up with the new selection.
  const handleVerticalModeClick = () => {
    toggleColumnMode();
    requestAnimationFrame(refreshFromSelection);
  };

  const handleBoldClick = () => {
    handleTextCommand("bold");
    setTimeout(() => {
      try {
        setIsBold(document.queryCommandState("bold"));
      } catch {
        // ignore
      }
    }, 10);
  };

  const handleItalicClick = () => {
    handleTextCommand("italic");
    setTimeout(() => {
      try {
        setIsItalic(document.queryCommandState("italic"));
      } catch {
        // ignore
      }
    }, 10);
  };

  const handleUnderlineClick = () => {
    handleTextCommand("underline");
    setTimeout(() => {
      try {
        setIsUnderline(document.queryCommandState("underline"));
      } catch {
        // ignore
      }
    }, 10);
  };

  const handleStrikethroughClick = () => {
    handleTextCommand("strikeThrough");
    setTimeout(() => {
      try {
        setIsStrikethrough(document.queryCommandState("strikeThrough"));
      } catch {
        // ignore
      }
    }, 10);
  };

  const handleTextColorChange: React.ChangeEventHandler<HTMLInputElement> = (
    e,
  ) => {
    const color = e.target.value;
    setTextColor(color);
    handleTextCommand("foreColor", color);
  };

  const toggleGlyphOnSelection = () => {
    let current = "";
    try {
      current = document.queryCommandValue("fontName") || "";
    } catch {
      // ignore
    }
    const isGlyph = current.toLowerCase().includes("glyphtrl");
    handleTextCommand(
      "fontName",
      isGlyph ? "Arial, sans-serif" : "GlyphTRL, sans-serif",
    );
    setTimeout(() => {
      try {
        const fontName = document.queryCommandValue("fontName") || "";
        setIsGlyphFont(fontName.toLowerCase().includes("glyphtrl"));
      } catch {
        // ignore
      }
    }, 10);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onImageSelected(result);
      if (inputRef.current) inputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleShadingPatternSelect = (pattern: string) => {
    if (onInsertFullShading) {
      onInsertFullShading(pattern);
    }
    setShowShadingModal(false);
  };
  return (
    <div
      data-keep-selection
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          e.preventDefault();
        }
      }}
      className={`
      border border-[#D8A86585] border-b-0 
      bg-[#FAE5C8] 
      px-3 py-2 
      flex flex-row flex-wrap items-center gap-3 
      rounded-t-lg
    `}
    >
      <button
        onClick={handleBoldClick}
        title="Bold (Ctrl/Cmd+B)"
        style={{
          padding: "4px 8px",
          backgroundColor: isBold ? "#ccaa83" : "transparent",
          color: isBold ? "white" : "#374151",
          border: `1px solid ${isBold ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        B
      </button>
      <button
        onClick={handleItalicClick}
        title="Italic (Ctrl/Cmd+I)"
        style={{
          padding: "4px 8px",
          backgroundColor: isItalic ? "#ccaa83" : "transparent",
          color: isItalic ? "white" : "#374151",
          border: `1px solid ${isItalic ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        I
      </button>
      <button
        onClick={handleUnderlineClick}
        title="Underline (Ctrl/Cmd+U)"
        style={{
          padding: "4px 8px",
          backgroundColor: isUnderline ? "#ccaa83" : "transparent",
          color: isUnderline ? "white" : "#374151",
          border: `1px solid ${isUnderline ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          textDecoration: "underline",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        U
      </button>
      <button
        onClick={handleStrikethroughClick}
        title="Strikethrough"
        style={{
          padding: "4px 8px",
          backgroundColor: isStrikethrough ? "#ccaa83" : "transparent",
          color: isStrikethrough ? "white" : "#374151",
          border: `1px solid ${isStrikethrough ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          textDecoration: "line-through",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        S
      </button>
      <button
        onClick={toggleGlyphOnSelection}
        title="Toggle GlyphTRL on selection"
        style={{
          padding: "4px 8px",
          backgroundColor: isGlyphFont ? "#ccaa83" : "transparent",
          color: isGlyphFont ? "white" : "#374151",
          border: `1px solid ${isGlyphFont ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        Latin
      </button>

      <input
        type="color"
        title="Text color"
        value={textColor}
        onChange={handleTextColorChange}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          background: "transparent",
          cursor: "pointer",
        }}
      />

      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />

      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => handleTextCommand("justifyLeft")}
          title="Align left"
          style={{
            padding: "4px 8px",
            backgroundColor: textAlign === "left" ? "#ccaa83" : "transparent",
            color: textAlign === "left" ? "white" : "#374151",
            border: `1px solid ${textAlign === "left" ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("justifyCenter")}
          title="Align center"
          style={{
            padding: "4px 8px",
            backgroundColor: textAlign === "center" ? "#ccaa83" : "transparent",
            color: textAlign === "center" ? "white" : "#374151",
            border: `1px solid ${textAlign === "center" ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("justifyRight")}
          title="Align right"
          style={{
            padding: "4px 8px",
            backgroundColor: textAlign === "right" ? "#ccaa83" : "transparent",
            color: textAlign === "right" ? "white" : "#374151",
            border: `1px solid ${textAlign === "right" ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("justifyFull")}
          title="Justify"
          style={{
            padding: "4px 8px",
            backgroundColor:
              textAlign === "justify" ? "#ccaa83" : "transparent",
            color: textAlign === "justify" ? "white" : "#374151",
            border: `1px solid ${textAlign === "justify" ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>

      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />

      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => handleTextCommand("insertUnorderedList")}
          title="Bulleted list"
          style={{
            padding: "4px 8px",
            backgroundColor: isUnorderedList ? "#ccaa83" : "transparent",
            color: isUnorderedList ? "white" : "#374151",
            border: `1px solid ${isUnorderedList ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("insertOrderedList")}
          title="Numbered list"
          style={{
            padding: "4px 8px",
            backgroundColor: isOrderedList ? "#ccaa83" : "transparent",
            color: isOrderedList ? "white" : "#374151",
            border: `1px solid ${isOrderedList ? "#ccaa83" : "#d1d5db"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("outdent")}
          title="Decrease indent"
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <IndentDecrease className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("indent")}
          title="Increase indent"
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <IndentIncrease className="w-4 h-4" />
        </button>
      </div>

      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />

      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => handleTextCommand("undo")}
          title="Undo"
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("redo")}
          title="Redo"
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleTextCommand("removeFormat")}
          title="Clear formatting"
          style={{
            padding: "4px 8px",
            backgroundColor: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />
      <TextSize textSize={textSize} setTextSize={setTextSize} />
      {/* --- Separator --- */}
      {/* <FontFamily fontFamily={fontFamily} setFontFamily={setFontFamily} /> */}
      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />
      <IconSize iconSize={iconSize} setIconSize={setIconSize} />
      {onIconVerticalAlign && (
        <>
          <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />
          <div
            style={{ display: "flex", gap: 2 }}
            title="Icon vertical alignment"
          >
            <button
              onClick={() => onIconVerticalAlign("top")}
              title="Align top"
              style={{
                padding: "2px 4px",
                backgroundColor:
                  iconVerticalAlign === "top" ? "#ccaa83" : "transparent",
                color: iconVerticalAlign === "top" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onIconVerticalAlign("middle")}
              title="Align middle"
              style={{
                padding: "2px 4px",
                backgroundColor:
                  iconVerticalAlign === "middle" ? "#ccaa83" : "transparent",
                color: iconVerticalAlign === "middle" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onIconVerticalAlign("bottom")}
              title="Align bottom"
              style={{
                padding: "2px 4px",
                backgroundColor:
                  iconVerticalAlign === "bottom" ? "#ccaa83" : "transparent",
                color: iconVerticalAlign === "bottom" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />
      <button
        onClick={openFilePicker}
        title="Insert Image"
        style={{
          padding: "2px 4px",
          backgroundColor: "transparent",
          color: "#374151",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        <Image className="w-4 h-4" />
      </button>

      <button
        onClick={() => setShowShadingModal(true)}
        title="Insert Shaded Icon"
        style={{
          backgroundColor: "transparent",
          color: "#374151",
          padding: "2px",
          // border: "1px solid #d1d5db",
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        ▨
      </button>

      {/* --- DIRECTION/MODE CONTROLS (Moved here) --- */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => setDirection("ltr")}
          title="Left-to-Right"
          style={{
            padding: "4px 8px",
            backgroundColor: direction === "ltr" ? "#ccaa83" : "#e5e7eb",
            color: direction === "ltr" ? "white" : "#374151",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setDirection("rtl")}
          title="Right-to-Left"
          style={{
            padding: "4px 8px",
            backgroundColor: direction === "rtl" ? "#ccaa83" : "#e5e7eb",
            color: direction === "rtl" ? "white" : "#374151",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={handleVerticalModeClick}
        title="Vertical mode: applies to your selection if any, otherwise to all hieroglyphs"
        style={{
          padding: "4px 8px",
          backgroundColor: isInVerticalRun ? "#ccaa83" : "transparent",
          color: isInVerticalRun ? "white" : "#374151",
          border: `1px solid ${isInVerticalRun ? "#ccaa83" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        Vertical Mode
      </button>

      {/* --- Separator --- */}
      <div style={{ height: 24, width: 1, backgroundColor: "#d1d5db" }} />

      {/* --- SHADING BUTTON --- */}
      {showShadingButton && !iconHasShading && (
        <button
          onClick={onShadingClick}
          title="Add Shading to Icon"
          style={{
            padding: "4px 8px",
            backgroundColor: "#10b981",
            color: "white",
            border: "1px solid #10b981",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          Shading
        </button>
      )}

      {/* --- REMOVE SHADING BUTTON --- */}
      {showShadingButton && iconHasShading && (
        <button
          onClick={onRemoveShadingClick}
          title="Remove Shading from Icon"
          style={{
            padding: "4px 8px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "1px solid #ef4444",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          Remove Shading
        </button>
      )}

      {/* --- GROUP ICONS --- */}
      <button
        onClick={mergeGroup}
        disabled={selectedIconCount < 2}
        title="Group selected icons vertically"
        style={{
          padding: "4px 8px",
          backgroundColor: selectedIconCount >= 2 ? "#3b82f6" : "transparent",
          color: selectedIconCount >= 2 ? "white" : "#374151",
          border: `1px solid ${selectedIconCount >= 2 ? "#3b82f6" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: selectedIconCount >= 2 ? "pointer" : "not-allowed",
          fontWeight: 500,
          fontSize: 12,
        }}
      >
        Group
      </button>

      {/* --- CARTOUCHE WRAP BUTTON --- */}
      <button
        onClick={onCartoucheWrap}
        disabled={selectedIconCount < 1}
        title="Wrap selected icons in Cartouche"
        style={{
          padding: "4px 6px",
          backgroundColor: selectedIconCount >= 1 ? "#d4a574" : "transparent",
          color: selectedIconCount >= 1 ? "white" : "#374151",
          border: `1px solid ${selectedIconCount >= 1 ? "#d4a574" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: selectedIconCount >= 1 ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CartoucheIcon />
      </button>

      {/* --- MAGIC BOX BUTTON --- */}
      <button
        onClick={onMagicBox}
        disabled={selectedIconCount < 2}
        title="Open Magic Box – freely arrange selected icons"
        style={{
          padding: "4px 10px",
          background:
            selectedIconCount >= 2
              ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
              : "transparent",
          color: selectedIconCount >= 2 ? "white" : "#374151",
          border: `1px solid ${selectedIconCount >= 2 ? "#8b5cf6" : "#d1d5db"}`,
          borderRadius: 4,
          cursor: selectedIconCount >= 2 ? "pointer" : "not-allowed",
          fontWeight: 600,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        &#x2728; Edit Group
      </button>

      {/* --- SHADING PATTERN MODAL --- */}
      {showShadingModal && (
        <ShadingPatterns
          onSelectPattern={handleShadingPatternSelect}
          onClose={() => setShowShadingModal(false)}
        />
      )}
    </div>
  );
};

export default Assistant;
