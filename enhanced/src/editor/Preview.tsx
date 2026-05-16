/* --------------------------------------------------------------------------
 *  Preview pane.
 *
 *  Reads the editor's doc and renders it the way the client will
 *  ultimately see it: HieroJax draws every contiguous run of
 *  hieroglyph + format-control codepoints as a properly laid-out
 *  quadrat (vertical/horizontal grouping, cartouche enclosures,
 *  small/full sizing). Latin text in the same paragraph renders as
 *  plain text alongside the SVG quadrats.
 *
 *  Two visual concerns:
 *
 *    1. Grouping / cartouche → encoded as Unicode format-control
 *       codepoints in the text. HieroJax handles them natively.
 *    2. Rotation → carried by the HieroRotation Mark. We render the
 *       rotated run through HieroJax (so the quadrat lays out
 *       correctly) and wrap the resulting SVG in a CSS-transformed
 *       span. HieroJax has no free-angle rotation primitive, so the
 *       wrapper is the cleanest sidestep — and it gives us "rotate
 *       the laid-out group as a unit", which is what JSesh does.
 *
 *  Re-render is rAF-debounced — typing fast won't flood HieroJax
 *  with redraws, but a single keystroke still updates within one
 *  frame.
 * ------------------------------------------------------------------------ */

import type { Editor } from "@tiptap/react";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { useEffect, useRef } from "react";
import { tryParse, whenReady } from "./hierojax";
import { isHieroglyphic } from "./unicode";
import "./Preview.css";

interface IProps {
  editor: Editor | null;
  fontSize: number;
  verticalMode: boolean;
  direction: "ltr" | "rtl";
}

interface Segment {
  kind: "hierojax" | "text";
  text: string;
  /** 0 = no rotation. Non-zero rotates the whole segment as a unit
   *  (a hierojax run becomes a single SVG quadrat that we then rotate
   *  via CSS — that's how JSesh renders rotated groups). */
  rotation: number;
  /** null = inherit the host's color. Otherwise any CSS color string;
   *  drives both the Latin text fill AND the HieroJax SVG fill (the
   *  vendor reads `color` off computed style at print time and bakes
   *  it into each `<text>`/`<tspan>` `fill` attribute). */
  color: string | null;
}

const findMark = (marks: readonly Mark[], name: string): Mark | undefined =>
  marks.find((m) => m.type.name === name);

/** Walk a paragraph's inline content into a flat list of segments
 *  ready for direct DOM emission. Adjacent chars merge when they
 *  share kind AND rotation AND color, which is what lets a rotated
 *  or recolored quadrat (signs + format-control joiners) survive as
 *  a single hierojax run instead of getting shredded into one span
 *  per codepoint (the joiner U+13430 has no glyph in the font, so
 *  per-codepoint splitting collapses the whole quadrat into "two
 *  signs separated by an invisible gap"). */
const segmentParagraph = (paragraph: PMNode): Segment[] => {
  const out: Segment[] = [];
  paragraph.descendants((node) => {
    if (!node.isText || !node.text) return;
    const rotMark = findMark(node.marks, "hieroRotation");
    const rotation = rotMark ? Number(rotMark.attrs.degrees) || 0 : 0;
    const colorMark = findMark(node.marks, "hieroColor");
    const colorAttr = colorMark ? colorMark.attrs.color : null;
    const color: string | null =
      typeof colorAttr === "string" && colorAttr.length > 0 ? colorAttr : null;
    for (const ch of node.text) {
      const cp = ch.codePointAt(0);
      const kind: Segment["kind"] =
        cp != null && isHieroglyphic(cp) ? "hierojax" : "text";
      const last = out[out.length - 1];
      if (
        last &&
        last.kind === kind &&
        last.rotation === rotation &&
        last.color === color
      ) {
        last.text += ch;
      } else {
        out.push({ kind, text: ch, rotation, color });
      }
    }
  });
  return out;
};

/** Should `text` be sent through HieroJax? Splitting a hieroglyph
 *  run around a rotated char can leave the surrounding pieces with
 *  orphan format-controls (e.g. a trailing BEGIN_ENCLOSURE), which
 *  HieroJax's parser rejects with a noisy red "parse error" badge.
 *  When the parser exists in `window.syntax`, validate up front
 *  and fall back to plain-text rendering on failure — the font
 *  still draws every codepoint, we just lose the quadrat layout for
 *  that fragment.
 *
 *  When the parser isn't loaded yet (early renders), assume valid;
 *  the next render after `whenReady()` will re-evaluate. */
const canRenderInHieroJax = (text: string): boolean => {
  if (!window.syntax) return true;
  return tryParse(text) === true;
};

/** Wrap `inner` in a `.hiero-rot` span carrying the rotation angle as
 *  a CSS variable. The actual `transform: rotate(...)` rule lives in
 *  Preview.css. */
const wrapRotated = (inner: Node, rotation: number): HTMLSpanElement => {
  const wrapper = document.createElement("span");
  wrapper.className = "hiero-rot";
  wrapper.style.setProperty("--hiero-rot", `${rotation}deg`);
  wrapper.appendChild(inner);
  return wrapper;
};

/** Wrap `inner` in a colored span. We set inline `color` so HieroJax
 *  (which inspects computed style at processing time) picks the same
 *  fill for the SVG it generates from any nested `.hierojax` span. */
const wrapColored = (inner: Node, color: string): HTMLSpanElement => {
  const wrapper = document.createElement("span");
  wrapper.className = "hiero-color";
  wrapper.style.color = color;
  wrapper.appendChild(inner);
  return wrapper;
};

/** Build the DOM for a single paragraph. */
const renderParagraph = (
  paragraph: PMNode,
  verticalMode: boolean,
): HTMLParagraphElement => {
  const p = document.createElement("p");
  for (const seg of segmentParagraph(paragraph)) {
    let node: Node;
    if (seg.kind === "hierojax") {
      const span = document.createElement("span");
      if (canRenderInHieroJax(seg.text)) {
        span.className = "hierojax";
        span.setAttribute("data-dir", verticalMode ? "vlr" : "hlr");
        // HieroJax reads `color` off computed style for `signcolor`;
        // setting it inline (and also as data-signcolor, which the
        // vendor explicitly honours) keeps both code paths in sync.
        if (seg.color) {
          span.style.color = seg.color;
          span.setAttribute("data-signcolor", seg.color);
        }
      } else if (seg.color) {
        span.style.color = seg.color;
      }
      span.textContent = seg.text;
      node = span;
    } else {
      node = document.createTextNode(seg.text);
      if (seg.color) node = wrapColored(node, seg.color);
    }
    if (seg.rotation) node = wrapRotated(node, seg.rotation);
    p.appendChild(node);
  }
  if (!p.firstChild) p.appendChild(document.createElement("br"));
  return p;
};

export const Preview = ({
  editor,
  fontSize,
  verticalMode,
  direction,
}: IProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!editor || !host) return;

    let frame: number | null = null;
    let cancelled = false;

    const render = () => {
      frame = null;
      if (cancelled) return;
      host.replaceChildren();
      editor.state.doc.forEach((node) => {
        if (node.type.name !== "paragraph") return;
        host.appendChild(renderParagraph(node, verticalMode));
      });
      whenReady()
        .then(() => {
          if (cancelled) return;
          window.hierojax?.processFragmentsIn(host);
        })
        .catch(() => {
          /* whenReady already logged the timeout */
        });
    };

    const schedule = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(render);
    };

    schedule();
    editor.on("transaction", schedule);
    return () => {
      cancelled = true;
      editor.off("transaction", schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
    // fontSize / verticalMode / direction are baked into the SVG by
    // HieroJax at render time, so we re-build when any of them
    // change.
  }, [editor, fontSize, verticalMode, direction]);

  return (
    <aside
      className="preview"
      aria-label="Live rendered preview"
      data-direction={direction}
      data-vertical-mode={verticalMode ? "true" : "false"}
    >
      <header className="preview__header">
        <h2 className="preview__title">Preview</h2>
        <p className="preview__hint">Live rendering</p>
      </header>
      <div
        ref={hostRef}
        className="preview__host"
        style={{ fontSize: `${fontSize}px` }}
      />
    </aside>
  );
};
