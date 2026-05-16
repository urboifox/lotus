/* --------------------------------------------------------------------------
 *  Editor pane.
 *
 *  Plain TipTap. Paragraph + text + bold/italic + history (StarterKit),
 *  plus the per-glyph rotation Mark. Hieroglyph signs and format-control
 *  characters are just text codepoints — selection, cursor placement,
 *  copy/paste, and undo all use the browser's native text engine.
 *
 *  The visual quadrat layout (vertical/horizontal grouping, cartouches)
 *  is the Preview pane's job — see Preview.tsx. This component owns the
 *  editing surface only.
 *
 *  The font stack `"Hieroglyphic", "Inter", …` lets the same paragraph
 *  mix Latin (rendered by Inter) with hieroglyph codepoints (rendered
 *  by NewGardiner.otf, which the HieroJax stylesheet declares under the
 *  family name `Hieroglyphic`). Browsers resolve fallback per-glyph, so
 *  no ranges or spans are needed.
 * ------------------------------------------------------------------------ */

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { HieroColor } from "./marks/HieroColor";
import { HieroRotation } from "./marks/HieroRotation";
import "./Editor.css";

const INITIAL = `
  <p>Type, or click a glyph on the left. Latin and hieroglyphs mix freely.</p>
  <p>Try: 𓀀𓁹𓅓𓏏 — drag-select the signs like normal text.</p>
`.trim();

interface IProps {
  onReady: (editor: ReturnType<typeof useEditor>) => void;
  direction: "ltr" | "rtl";
  fontSize: number;
}

export const Editor = ({ onReady, direction, fontSize }: IProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        code: false,
        strike: false,
      }),
      HieroRotation,
      HieroColor,
    ],
    content: INITIAL,
    editorProps: {
      attributes: {
        class: "lotus-editor",
        spellcheck: "false",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Hieroglyph editor",
      },
    },
  });

  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);

  // Headless smoke tests grab the editor handle off `window` in dev.
  useEffect(() => {
    if (!editor || !import.meta.env.DEV) return;
    (window as unknown as { __lotusEditor?: typeof editor }).__lotusEditor =
      editor;
    return () => {
      delete (window as unknown as { __lotusEditor?: typeof editor })
        .__lotusEditor;
    };
  }, [editor]);

  return (
    <div
      className="lotus-editor-host"
      data-direction={direction}
      style={{ fontSize: `${fontSize}px` }}
    >
      <EditorContent editor={editor} />
    </div>
  );
};
