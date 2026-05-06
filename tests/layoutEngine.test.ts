import { describe, expect, test } from "vitest";

import { seedGlyphMetadata } from "../src/glyphs/seedGlyphMetadata";
import {
  computeGlyphLayout,
  computeLayout,
} from "../src/layout/layoutEngine";
import type { GlyphNode, GroupNode } from "../src/schema/types";

describe("layoutEngine", () => {
  test("Single glyph A1 -> width=0.75, height=1.0, no children", () => {
    const node: GlyphNode = { type: "glyph", id: "A1", sizeOverride: null };
    const layout = computeGlyphLayout(node, seedGlyphMetadata);

    expect(layout.width).toBeCloseTo(0.75, 6);
    expect(layout.height).toBeCloseTo(1.0, 6);
    expect(layout.children).toHaveLength(0);
  });

  test("A1:G5 vertical -> height=1.0, first child ty=0, last child bottom≈1.0, scale≤1.0", () => {
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "A1", sizeOverride: null },
        { type: "glyph", id: "G5", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const first = layout.children[0];
    const last = layout.children[1];
    const lastBottom = last.ty + 1.0 * last.sy;

    expect(layout.height).toBeCloseTo(1.0, 6);
    expect(first.ty).toBeCloseTo(0, 6);
    expect(lastBottom).toBeCloseTo(1.0, 6);
    expect(first.sx).toBeLessThanOrEqual(1.0);
  });

  test("n:p:i three glyphs vertical -> verify scale=(1.0-0.04)/(0.25+0.30+1.0), last bottom≈1.0", () => {
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "p", sizeOverride: null },
        { type: "glyph", id: "i", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const expectedScale = (1.0 - 0.04) / (0.25 + 0.3 + 1.0);
    const last = layout.children[2];
    const lastBottom = last.ty + 1.0 * last.sy;

    expect(layout.children[0].sx).toBeCloseTo(expectedScale, 6);
    expect(lastBottom).toBeCloseTo(1.0, 6);
  });

  test("n:p:i:t four glyphs -> scale=(1.0-0.06)/(0.25+0.30+1.0+0.30), last bottom≈1.0", () => {
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "p", sizeOverride: null },
        { type: "glyph", id: "i", sizeOverride: null },
        { type: "glyph", id: "t", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const expectedScale = (1.0 - 0.06) / (0.25 + 0.3 + 1.0 + 0.3);
    const last = layout.children[3];
    const lastBottom = last.ty + 0.3 * last.sy;

    expect(layout.children[0].sx).toBeCloseTo(expectedScale, 6);
    expect(lastBottom).toBeCloseTo(1.0, 6);
  });

  test("A1*G5 horizontal -> width=1.0, first child tx=0, last child right edge≈1.0", () => {
    const node: GroupNode = {
      type: "group",
      layout: "horizontal",
      children: [
        { type: "glyph", id: "A1", sizeOverride: null },
        { type: "glyph", id: "G5", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const first = layout.children[0];
    const last = layout.children[1];
    const lastRight = last.tx + 0.8 * last.sx;

    expect(layout.width).toBeCloseTo(1.0, 6);
    expect(first.tx).toBeCloseTo(0, 6);
    expect(lastRight).toBeCloseTo(1.0, 6);
  });

  test("(n*p):A1 nested -> inner horizontal group computed first, then vertical with A1", () => {
    const inner: GroupNode = {
      type: "group",
      layout: "horizontal",
      children: [
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "p", sizeOverride: null },
      ],
    };
    const outer: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [inner, { type: "glyph", id: "A1", sizeOverride: null }],
    };

    const innerLayout = computeLayout(inner, seedGlyphMetadata);
    const outerLayout = computeLayout(outer, seedGlyphMetadata);
    const last = outerLayout.children[1];
    const lastBottom = last.ty + 1.0 * last.sy;

    expect(innerLayout.width).toBeCloseTo(1.0, 6);
    expect(outerLayout.children[0].node).toBe(inner);
    expect(outerLayout.children[0].ty).toBeCloseTo(0, 6);
    expect(lastBottom).toBeCloseTo(1.0, 6);
  });

  test("unknown glyph uses deterministic fallback metadata", () => {
    const node: GlyphNode = { type: "glyph", id: "B1", sizeOverride: null };
    const layout = computeGlyphLayout(node, seedGlyphMetadata);

    expect(layout.width).toBeCloseTo(0.75, 6);
    expect(layout.height).toBeCloseTo(1.0, 6);
  });

  test("layout output is deterministic for the same nested input", () => {
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [
        {
          type: "group",
          layout: "horizontal",
          children: [
            { type: "glyph", id: "n", sizeOverride: null },
            { type: "glyph", id: "p", sizeOverride: null },
          ],
        },
        { type: "glyph", id: "A1", sizeOverride: null },
      ],
    };

    const first = computeLayout(node, seedGlyphMetadata);
    const second = computeLayout(node, seedGlyphMetadata);

    expect(second).toEqual(first);
  });

  test("20 glyph vertical group remains stable and ends at 1.0", () => {
    const children: GlyphNode[] = Array.from({ length: 20 }, () => ({
      type: "glyph",
      id: "Z1",
      sizeOverride: null,
    }));
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children,
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const last = layout.children[19];
    const lastBottom = last.ty + 0.08 * last.sy;

    expect(layout.height).toBeCloseTo(1.0, 6);
    expect(lastBottom).toBeCloseTo(1.0, 6);
    expect(layout.children[0].sy).toBeLessThanOrEqual(1.0);
  });

  test("mixed-size horizontal group remains bounded to 1.0 width", () => {
    const node: GroupNode = {
      type: "group",
      layout: "horizontal",
      children: [
        { type: "glyph", id: "i", sizeOverride: null },
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "A1", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);
    const last = layout.children[2];
    const lastRight = last.tx + 0.75 * last.sx;

    expect(layout.width).toBeCloseTo(1.0, 6);
    expect(lastRight).toBeCloseTo(1.0, 6);
  });

  test("small glyph stacks distribute extra space through gaps instead of bottom padding", () => {
    const node: GroupNode = {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "Z1", sizeOverride: null },
        { type: "glyph", id: "Z1", sizeOverride: null },
        { type: "glyph", id: "Z1", sizeOverride: null },
      ],
    };

    const layout = computeLayout(node, seedGlyphMetadata);

    expect(layout.children[1].ty).toBeCloseTo(0.46, 6);
    expect(layout.children[2].ty).toBeCloseTo(0.92, 6);
    expect(layout.children[2].ty + 0.08 * layout.children[2].sy).toBeCloseTo(
      1.0,
      6,
    );
  });
});
