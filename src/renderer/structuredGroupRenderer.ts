import { computeLayout } from "../layout/layoutEngine";
import type { GroupNode } from "../schema/types";
import type { GlyphMetadata } from "../schema/types";

const SVG_NS = "http://www.w3.org/2000/svg";

type ChildVisual = {
  markup: string;
  width: number;
  height: number;
};

type StructuredGroupRenderResult = {
  svg: SVGSVGElement;
  width: number;
  height: number;
};

function parseSvgMarkup(markup: string): SVGSVGElement | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, "image/svg+xml");
  const svg = doc.querySelector("svg");
  return svg instanceof SVGSVGElement ? svg : null;
}

function cloneVisualSvg(markup: string): SVGSVGElement {
  const parsed = parseSvgMarkup(markup);
  const svg =
    parsed ||
    document.createElementNS(SVG_NS, "svg");
  if (!parsed) {
    svg.setAttribute("viewBox", "0 0 1 1");
  }
  return svg.cloneNode(true) as SVGSVGElement;
}

function getSvgBox(svg: SVGSVGElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return {
        x: parts[0] || 0,
        y: parts[1] || 0,
        width: parts[2],
        height: parts[3],
      };
    }
  }

  const width =
    parseFloat(svg.getAttribute("width") || "") ||
    parseFloat(svg.style.width || "") ||
    1;
  const height =
    parseFloat(svg.getAttribute("height") || "") ||
    parseFloat(svg.style.height || "") ||
    1;

  return {
    x: 0,
    y: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function renderStructuredGroupSvg(
  groupNode: GroupNode,
  visuals: ChildVisual[],
  boxSize: number,
  db: Map<string, GlyphMetadata>,
): StructuredGroupRenderResult {
  const layout = computeLayout(groupNode, db);
  const topLevelChildLayouts = groupNode.children.map((child) =>
    computeLayout(child, db, true),
  );

  const width = Math.max(1, layout.width * boxSize);
  const height = Math.max(1, layout.height * boxSize);
  const rootSvg = document.createElementNS(SVG_NS, "svg");
  rootSvg.setAttribute("xmlns", SVG_NS);
  rootSvg.setAttribute("width", `${width}`);
  rootSvg.setAttribute("height", `${height}`);
  rootSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  rootSvg.dataset.groupRoot = "true";
  rootSvg.style.overflow = "visible";
  rootSvg.style.display = "block";

  layout.children.forEach((child, index) => {
    const childSvg = cloneVisualSvg(visuals[index].markup);
    const childWidth = topLevelChildLayouts[index].width * child.sx * boxSize;
    const childHeight = topLevelChildLayouts[index].height * child.sy * boxSize;
    const childBox = getSvgBox(childSvg);
    const scaleX = childWidth / childBox.width;
    const scaleY = childHeight / childBox.height;
    const scale = Math.min(scaleX, scaleY);
    const renderedWidth = childBox.width * scale;
    const renderedHeight = childBox.height * scale;
    const translateX =
      child.tx * boxSize + (childWidth - renderedWidth) / 2 - childBox.x * scale;
    const translateY =
      child.ty * boxSize + (childHeight - renderedHeight) / 2 - childBox.y * scale;

    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute(
      "transform",
      `translate(${translateX} ${translateY}) scale(${scale} ${scale})`,
    );
    group.dataset.groupChild = "true";
    group.dataset.groupIndex = String(index);
    group.dataset.sourceMarkup = visuals[index].markup;
    group.dataset.sourceNaturalW = String(visuals[index].width);
    group.dataset.sourceNaturalH = String(visuals[index].height);
    group.dataset.renderedWidth = String(renderedWidth);
    group.dataset.renderedHeight = String(renderedHeight);
    group.dataset.renderedX = String(child.tx * boxSize + (childWidth - renderedWidth) / 2);
    group.dataset.renderedY = String(child.ty * boxSize + (childHeight - renderedHeight) / 2);

    Array.from(childSvg.childNodes).forEach((node) => {
      group.appendChild(node.cloneNode(true));
    });
    rootSvg.appendChild(group);
  });

  return { svg: rootSvg, width, height };
}
