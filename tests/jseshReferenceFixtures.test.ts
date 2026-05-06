import { describe, expect, test } from "vitest";

import { jseshReferenceFixtures } from "../src/debug/jseshReferenceFixtures";
import { seedGlyphMetadata } from "../src/glyphs/seedGlyphMetadata";
import { computeLayout } from "../src/layout/layoutEngine";

describe("jsesh reference fixtures", () => {
  test.each(jseshReferenceFixtures)("$label matches reference metrics", (fixture) => {
    const actual = computeLayout(fixture.node, seedGlyphMetadata);
    const childLayouts = fixture.node.children.map((child) =>
      computeLayout(child, seedGlyphMetadata, true),
    );
    const lastIndex = actual.children.length - 1;
    const last = actual.children[lastIndex];
    const lastEdge =
      fixture.node.layout === "horizontal"
        ? last.tx + childLayouts[lastIndex].width * last.sx
        : last.ty + childLayouts[lastIndex].height * last.sy;

    expect(actual.width).toBeCloseTo(fixture.expected.width, 6);
    expect(actual.height).toBeCloseTo(fixture.expected.height, 6);
    expect(lastEdge).toBeCloseTo(fixture.expected.lastEdge, 6);
  });
});
