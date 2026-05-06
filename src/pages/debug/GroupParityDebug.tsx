import { computeLayout } from "@/layout/layoutEngine";
import { seedGlyphMetadata } from "@/glyphs/seedGlyphMetadata";
import { jseshReferenceFixtures } from "@/debug/jseshReferenceFixtures";

type Box = { x: number; y: number; width: number; height: number };

function renderLayoutPreview(
  width: number,
  height: number,
  children: Box[],
  variant: "actual" | "reference",
) {
  const scale = 180;
  const fill = variant === "actual" ? "rgba(0,116,255,0.18)" : "rgba(220,38,38,0.16)";
  const stroke = variant === "actual" ? "#0074ff" : "#dc2626";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={Math.max(120, width * scale)}
      height={Math.max(120, height * scale)}
      className="border border-[#D8A86585] bg-white"
    >
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="#222" strokeWidth="0.01" />
      {children.map((child, index) => (
        <rect
          key={index}
          x={child.x}
          y={child.y}
          width={child.width}
          height={child.height}
          fill={fill}
          stroke={stroke}
          strokeWidth="0.01"
        />
      ))}
    </svg>
  );
}

function renderOverlayPreview(
  width: number,
  height: number,
  referenceChildren: Box[],
  actualChildren: Box[],
) {
  const scale = 180;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={Math.max(120, width * scale)}
      height={Math.max(120, height * scale)}
      className="border border-[#D8A86585] bg-white"
    >
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="#222" strokeWidth="0.01" />
      {referenceChildren.map((child, index) => (
        <rect
          key={`ref-${index}`}
          x={child.x}
          y={child.y}
          width={child.width}
          height={child.height}
          fill="rgba(220,38,38,0.16)"
          stroke="#dc2626"
          strokeWidth="0.01"
        />
      ))}
      {actualChildren.map((child, index) => (
        <rect
          key={`act-${index}`}
          x={child.x}
          y={child.y}
          width={child.width}
          height={child.height}
          fill="rgba(0,116,255,0.14)"
          stroke="#0074ff"
          strokeWidth="0.01"
        />
      ))}
    </svg>
  );
}

export default function GroupParityDebug() {
  const rows = jseshReferenceFixtures.map((fixture) => {
    const actual = computeLayout(fixture.node, seedGlyphMetadata);
    const actualChildren = fixture.node.children.map((child, index) => {
      const childLayout = computeLayout(child, seedGlyphMetadata, true);
      return {
        x: actual.children[index].tx,
        y: actual.children[index].ty,
        width: childLayout.width * actual.children[index].sx,
        height: childLayout.height * actual.children[index].sy,
      };
    });
    const last = actualChildren[actualChildren.length - 1];
    const actualLastEdge =
      fixture.node.layout === "horizontal"
        ? last.x + last.width
        : last.y + last.height;
    const spacingDiff = fixture.referenceChildren.reduce((sum, refChild, index) => {
      const actualChild = actualChildren[index];
      return (
        sum +
        Math.abs(refChild.x - actualChild.x) +
        Math.abs(refChild.y - actualChild.y) +
        Math.abs(refChild.width - actualChild.width) +
        Math.abs(refChild.height - actualChild.height)
      );
    }, 0);

    return {
      fixture,
      actual,
      actualLastEdge,
      deltas: {
        width: actual.width - fixture.expected.width,
        height: actual.height - fixture.expected.height,
        lastEdge: actualLastEdge - fixture.expected.lastEdge,
      },
      spacingDiff,
      actualChildren,
    };
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Group Parity Debug</h1>
      <p className="text-sm text-gray-600">
        Structured group layout compared against fixed reference fixtures derived from the Jsesh rule set.
      </p>
      <div className="space-y-6">
        {rows.map(({ fixture, actual, deltas, spacingDiff, actualChildren }) => (
          <div key={fixture.id} className="border border-[#D8A86585] rounded-md p-4 bg-[#FEFBF7]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">{fixture.label}</h2>
              <code className="text-xs">{fixture.node.layout}</code>
            </div>
            <div className="grid lg:grid-cols-3 gap-4 items-start">
              <div>
                <div className="text-sm mb-2">Reference</div>
                {renderLayoutPreview(
                  fixture.expected.width,
                  fixture.expected.height,
                  fixture.referenceChildren,
                  "reference",
                )}
              </div>
              <div>
                <div className="text-sm mb-2">Actual</div>
                {renderLayoutPreview(actual.width, actual.height, actualChildren, "actual")}
              </div>
              <div>
                <div className="text-sm mb-2">Overlay / diff</div>
                {renderOverlayPreview(
                  Math.max(fixture.expected.width, actual.width),
                  Math.max(fixture.expected.height, actual.height),
                  fixture.referenceChildren,
                  actualChildren,
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="text-sm space-y-1">
                <div>Expected width: {fixture.expected.width.toFixed(6)}</div>
                <div>Actual width: {actual.width.toFixed(6)}</div>
                <div>Delta width: {deltas.width.toFixed(6)}</div>
                <div>Expected height: {fixture.expected.height.toFixed(6)}</div>
                <div>Actual height: {actual.height.toFixed(6)}</div>
                <div>Delta height: {deltas.height.toFixed(6)}</div>
              </div>
              <div className="text-sm space-y-1">
                <div>Expected boundary edge: {fixture.expected.lastEdge.toFixed(6)}</div>
                <div>Actual boundary edge: {(fixture.node.layout === "horizontal"
                  ? actualChildren[actualChildren.length - 1].x + actualChildren[actualChildren.length - 1].width
                  : actualChildren[actualChildren.length - 1].y + actualChildren[actualChildren.length - 1].height
                ).toFixed(6)}</div>
                <div>Delta boundary edge: {deltas.lastEdge.toFixed(6)}</div>
                <div>Aggregate spacing diff: {spacingDiff.toFixed(6)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
