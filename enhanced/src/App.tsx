/* --------------------------------------------------------------------------
 *  Top-level page.
 *
 *  Three-pane layout:
 *
 *    +-------------------------------------------------------+
 *    |                       Top bar                         |
 *    +-----------+-------------------------+-----------------+
 *    |           |        Toolbar          |                 |
 *    |  Palette  +-------------------------+    Preview      |
 *    |           |        Editor           |  (HieroJax)     |
 *    |           |   (plain Unicode text)  |                 |
 *    +-----------+-------------------------+-----------------+
 *
 *  The TipTap editor instance is hoisted here so the toolbar, the
 *  palette, AND the preview can all read from it. Document state lives
 *  inside TipTap; transient view state (font-size, direction, vertical
 *  mode) lives in this component.
 * ------------------------------------------------------------------------ */

import { useCallback, useState } from "react";
import type { Editor as EditorType } from "@tiptap/react";
import { Editor } from "./editor/Editor";
import { Preview } from "./editor/Preview";
import { GlyphPalette } from "./components/GlyphPalette";
import { Toolbar } from "./components/Toolbar";
import "./App.css";

const App = () => {
  const [editor, setEditor] = useState<EditorType | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [verticalMode, setVerticalMode] = useState(false);

  const handleReady = useCallback((next: EditorType | null) => {
    setEditor(next);
  }, []);

  return (
    <div className="app">
      <header className="app__topbar">
        <div className="app__brand">
          <span className="app__brand-mark hg">𓋹</span>
          <div>
            <h1 className="app__brand-title">Lotus</h1>
            <p className="app__brand-sub">Hieroglyph editor — prototype</p>
          </div>
        </div>
      </header>

      <main className="app__main">
        <GlyphPalette editor={editor} />
        <section className="app__editor">
          <Toolbar
            editor={editor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            direction={direction}
            setDirection={setDirection}
            verticalMode={verticalMode}
            setVerticalMode={setVerticalMode}
          />
          <Editor
            onReady={handleReady}
            direction={direction}
            fontSize={fontSize}
          />
        </section>
        <Preview
          editor={editor}
          fontSize={fontSize}
          verticalMode={verticalMode}
          direction={direction}
        />
      </main>
    </div>
  );
};

export default App;
