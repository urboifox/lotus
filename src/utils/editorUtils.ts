// Editor utility functions
export const getSvgTransform = (direction: "ltr" | "rtl"): string => {
  return direction === "rtl" ? "scaleX(-1)" : "none";
};

export const createSvgWrapper = (
  svgString: string,
  direction: "ltr" | "rtl",
  draggedElementRef: React.MutableRefObject<HTMLElement | null>,
  dragSourceRef: React.MutableRefObject<string>
): HTMLElement => {
  const wrapper = document.createElement("span");
  wrapper.className = "svg-icon";
  wrapper.contentEditable = "false";
  wrapper.draggable = true;
  wrapper.dataset.id = Math.random().toString(36).substr(2, 9);
  wrapper.style.cssText = `
    display: inline-block;
    cursor: move;
    margin: 0 2px;
    vertical-align: middle;
    user-select: none;
    transform: ${getSvgTransform(direction)};
  `;
  wrapper.innerHTML = svgString;

  wrapper.ondragstart = (e) => {
    e.stopPropagation();
    draggedElementRef.current = wrapper;
    dragSourceRef.current = "editor";
    wrapper.style.opacity = "0.5";
  };

  wrapper.ondragend = () => {
    draggedElementRef.current = null;
    dragSourceRef.current = "";
    wrapper.style.opacity = "1";
  };

  return wrapper;
};

export const getEditorStyles = (
  direction: "ltr" | "rtl",
  columnMode: boolean
) => {
  if (columnMode && direction === "rtl") {
    return {
      direction: "ltr" as const,
      textAlign: "left" as const,
      writingMode: "vertical-lr" as const,
      textOrientation: "upright" as const,
    };
  }

  if (columnMode) {
    return {
      direction: "ltr" as const,
      textAlign: "left" as const,
      writingMode: "vertical-lr" as const,
      textOrientation: "upright" as const,
    };
  }

  return {
    direction: direction,
    textAlign: direction === "rtl" ? ("right" as const) : ("left" as const),
    writingMode: "horizontal-tb" as const,
    textOrientation: "mixed" as const,
  };
};

export const getCaretRangeFromPoint = (x: number, y: number): Range | null => {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }

  // Firefox support
  const typedDoc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number };
  };

  if (typedDoc.caretPositionFromPoint) {
    const caretPos = typedDoc.caretPositionFromPoint(x, y);
    if (caretPos) {
      const range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.collapse(true);
      return range;
    }
  }

  return null;
};
