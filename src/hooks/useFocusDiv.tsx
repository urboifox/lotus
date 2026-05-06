import { useRef } from "react";
export const useFocusDiv = () => {
  const divRef = useRef<HTMLDivElement>(null);

  const focusAtEnd = () => {
    if (divRef.current) {
      const div = divRef.current;

      // Clean up any leading <br> tags first (keep it simple)
      if (div.innerHTML.startsWith("<br>")) {
        div.innerHTML = div.innerHTML.substring(4);
      }

      div.focus();

      // Move cursor to the end of content
      const range = document.createRange();
      const selection = window.getSelection();

      if (div.childNodes.length > 0) {
        const lastNode = div.lastChild;
        if (lastNode?.nodeType === Node.TEXT_NODE) {
          // If last node is text, position at end of text
          range.setStart(lastNode, lastNode.textContent?.length || 0);
        } else if (lastNode?.nodeName === "BR") {
          // If last node is a BR, position before it
          range.setStartBefore(lastNode);
        } else {
          // If last node is element, position after it
          range.setStartAfter(lastNode!);
        }
      } else {
        range.setStart(div, 0);
      }

      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  return { divRef, focusAtEnd };
};
