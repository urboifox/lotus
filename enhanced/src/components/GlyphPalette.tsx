/* --------------------------------------------------------------------------
 *  Glyph palette (left sidebar).
 *
 *  Renders the catalogue as a grid of clickable tiles. Clicking inserts
 *  the glyph at the current caret position via the TipTap command chain
 *  — no DOM manipulation, no manual selection juggling. The Unicode
 *  character is the entire payload; the receiving editor relies on its
 *  font-family fallback chain to render it.
 *
 *  Drag-and-drop uses the `text/plain` MIME type: dropping a glyph into
 *  the editor inserts the character at the drop point natively, no
 *  extra plumbing needed.
 * ------------------------------------------------------------------------ */

import type { Editor } from "@tiptap/react";
import { GLYPHS } from "../data/glyphs";
import type { Glyph, GlyphType } from "../data/glyphs";
import "./GlyphPalette.css";

interface IProps {
  editor: Editor | null;
}

const TYPE_LABEL: Record<GlyphType, string> = {
  full: "Full",
  horizontal: "Horizontal",
  vertical: "Vertical",
  small: "Small",
};

/** Group the glyph catalogue by type — keeps the palette scannable. */
const groupByType = (glyphs: Glyph[]): Record<GlyphType, Glyph[]> => {
  const groups: Record<GlyphType, Glyph[]> = {
    full: [],
    horizontal: [],
    vertical: [],
    small: [],
  };
  for (const g of glyphs) groups[g.type].push(g);
  return groups;
};

export const GlyphPalette = ({ editor }: IProps) => {
  const grouped = groupByType(GLYPHS);

  const insert = (glyph: Glyph) => {
    if (!editor) return;
    // The whole hieroglyph layer is now plain text — clicking a tile
    // is just a normal `insertContent` at the caret, no atom node, no
    // auto-flow plugin. Selection / undo / paste all behave like
    // typing the same codepoint.
    editor.chain().focus().insertContent(glyph.char).run();
  };

  return (
    <aside className="palette" aria-label="Glyph catalogue">
      <header className="palette__header">
        <h2 className="palette__title">Glyphs</h2>
        <p className="palette__hint">Click to insert</p>
      </header>

      <div className="palette__sections">
        {(Object.keys(grouped) as GlyphType[]).map((type) => {
          const list = grouped[type];
          if (!list.length) return null;
          return (
            <section className="palette__section" key={type}>
              <h3 className="palette__section-title">{TYPE_LABEL[type]}</h3>
              <div className="palette__grid">
                {list.map((g) => (
                  <button
                    key={g.code}
                    type="button"
                    className="palette__tile"
                    title={`${g.code} — ${g.label}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", g.char);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => insert(g)}
                    onMouseDown={(e) => {
                      // Prevent the click from stealing focus from the
                      // editor — keeps the caret visible so the insert
                      // lands where the user expects.
                      e.preventDefault();
                    }}
                  >
                    <span className="palette__char hg">{g.char}</span>
                    <span className="palette__code">{g.code}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};
