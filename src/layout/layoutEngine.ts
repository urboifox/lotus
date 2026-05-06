import type {
  ComputedLayout,
  GlyphMetadata,
  GlyphNode,
  GroupNode,
  PositionedChild,
} from "../schema/types";
import { resolveGlyphMetadata } from "../glyphs/resolveGlyphMetadata";

export const INTER_SIGN_GAP = 0.02;
export const EMBEDDED_GAP = 0.01;

export function computeGlyphLayout(
  node: GlyphNode,
  db: Map<string, GlyphMetadata>,
): ComputedLayout {
  const metadata = resolveGlyphMetadata(node.id, db);
  const sizeFactor =
    node.sizeOverride !== null
      ? node.sizeOverride / 100
      : metadata.defaultRelativeSize / 100;

  return {
    width: metadata.naturalWidth * sizeFactor,
    height: metadata.naturalHeight * sizeFactor,
    children: [],
  };
}

export function computeVerticalLayout(
  node: GroupNode,
  db: Map<string, GlyphMetadata>,
  gap: number,
  embedded: boolean,
): ComputedLayout {
  const childLayouts = node.children.map((child) =>
    computeLayout(child, db, true),
  );
  const childCount = childLayouts.length;

  if (childCount === 0) {
    return { width: 0, height: 0, children: [] };
  }

  const actualGap = embedded ? EMBEDDED_GAP : gap;
  const totalNaturalHeight = childLayouts.reduce(
    (sum, child) => sum + child.height,
    0,
  );
  const minTotalGaps = actualGap * Math.max(0, childCount - 1);
  const scale = Math.min(1, (1 - minTotalGaps) / totalNaturalHeight);
  const scaledHeights = childLayouts.map((child) => child.height * scale);
  const scaledTotalHeight = scaledHeights.reduce((sum, value) => sum + value, 0);
  const distributedGap =
    childCount > 1
      ? Math.max(actualGap, (1 - scaledTotalHeight) / (childCount - 1))
      : 0;
  const groupWidth = Math.max(...childLayouts.map((child) => child.width * scale));

  let currentY = 0;
  const positionedChildren: PositionedChild[] = childLayouts.map(
    (childLayout, index) => {
      const positionedChild: PositionedChild = {
        node: node.children[index],
        tx: 0,
        ty: currentY,
        sx: scale,
        sy: scale,
      };
      currentY +=
        childLayout.height * scale +
        (index < childCount - 1 ? distributedGap : 0);
      return positionedChild;
    },
  );

  if (childCount > 1) {
    const lastIndex = childCount - 1;
    positionedChildren[lastIndex].ty = 1 - scaledHeights[lastIndex];
  }

  return {
    width: groupWidth,
    height: scaledTotalHeight + distributedGap * Math.max(0, childCount - 1),
    children: positionedChildren.map((child, index) => ({
      ...child,
      tx: (groupWidth - childLayouts[index].width * scale) / 2,
    })),
  };
}

export function computeHorizontalLayout(
  node: GroupNode,
  db: Map<string, GlyphMetadata>,
  gap: number,
  embedded: boolean,
): ComputedLayout {
  const childLayouts = node.children.map((child) =>
    computeLayout(child, db, true),
  );
  const childCount = childLayouts.length;

  if (childCount === 0) {
    return { width: 0, height: 0, children: [] };
  }

  const actualGap = embedded ? EMBEDDED_GAP : gap;
  const totalNaturalWidth = childLayouts.reduce(
    (sum, child) => sum + child.width,
    0,
  );
  const minTotalGaps = actualGap * Math.max(0, childCount - 1);
  const scale = Math.min(1, (1 - minTotalGaps) / totalNaturalWidth);
  const scaledWidths = childLayouts.map((child) => child.width * scale);
  const scaledTotalWidth = scaledWidths.reduce((sum, value) => sum + value, 0);
  const distributedGap =
    childCount > 1
      ? Math.max(actualGap, (1 - scaledTotalWidth) / (childCount - 1))
      : 0;
  const groupHeight = Math.max(...childLayouts.map((child) => child.height * scale));

  let currentX = 0;
  const positionedChildren: PositionedChild[] = childLayouts.map(
    (childLayout, index) => {
      const positionedChild: PositionedChild = {
        node: node.children[index],
        tx: currentX,
        ty: (groupHeight - childLayout.height * scale) / 2,
        sx: scale,
        sy: scale,
      };
      currentX +=
        childLayout.width * scale +
        (index < childCount - 1 ? distributedGap : 0);
      return positionedChild;
    },
  );

  if (childCount > 1) {
    const lastIndex = childCount - 1;
    positionedChildren[lastIndex].tx = 1 - scaledWidths[lastIndex];
  }

  return {
    width: scaledTotalWidth + distributedGap * Math.max(0, childCount - 1),
    height: groupHeight,
    children: positionedChildren,
  };
}

export function computeLayout(
  node: GlyphNode | GroupNode,
  db: Map<string, GlyphMetadata>,
  embedded = false,
): ComputedLayout {
  if (node.type === "glyph") {
    return computeGlyphLayout(node, db);
  }

  const gap = embedded ? EMBEDDED_GAP : INTER_SIGN_GAP;

  switch (node.layout) {
    case "vertical":
      return computeVerticalLayout(node, db, gap, embedded);
    case "horizontal":
      return computeHorizontalLayout(node, db, gap, embedded);
    default:
      throw new Error(`Unsupported layout: ${(node as GroupNode).layout}`);
  }
}
