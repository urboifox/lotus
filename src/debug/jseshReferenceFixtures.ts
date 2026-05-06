import type { GroupNode } from "../schema/types";

export type JseshReferenceFixture = {
  id: string;
  label: string;
  node: GroupNode;
  expected: {
    width: number;
    height: number;
    lastEdge: number;
  };
  referenceChildren: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

const DEC = (value: string) => Number.parseFloat(value);

export const jseshReferenceFixtures: JseshReferenceFixture[] = [
  {
    id: "vertical-2",
    label: "A1:G5",
    node: {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "A1", sizeOverride: null },
        { type: "glyph", id: "G5", sizeOverride: null },
      ],
    },
    expected: {
      width: 0.392,
      height: 1,
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0.01225, y: 0, width: 0.3675, height: 0.49 },
      { x: 0, y: 0.51, width: 0.392, height: 0.49 },
    ],
  },
  {
    id: "vertical-3",
    label: "n:p:i",
    node: {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "p", sizeOverride: null },
        { type: "glyph", id: "i", sizeOverride: null },
      ],
    },
    expected: {
      width: DEC("0.37161290322580645"),
      height: 1,
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0, y: 0, width: DEC("0.37161290322580645"), height: DEC("0.15483870967741936") },
      {
        x: DEC("0.030967741935483874"),
        y: DEC("0.17483870967741935"),
        width: DEC("0.3096774193548387"),
        height: DEC("0.18580645161290324"),
      },
      {
        x: DEC("0.09290322580645162"),
        y: DEC("0.38064516129032255"),
        width: DEC("0.1858064516129032"),
        height: DEC("0.6193548387096774"),
      },
    ],
  },
  {
    id: "vertical-4",
    label: "n:p:i:t",
    node: {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "n", sizeOverride: null },
        { type: "glyph", id: "p", sizeOverride: null },
        { type: "glyph", id: "i", sizeOverride: null },
        { type: "glyph", id: "t", sizeOverride: null },
      ],
    },
    expected: {
      width: DEC("0.3048648648648648"),
      height: 1,
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0, y: 0, width: DEC("0.3048648648648648"), height: DEC("0.127027027027027") },
      {
        x: DEC("0.025405405405405396"),
        y: DEC("0.147027027027027"),
        width: DEC("0.254054054054054"),
        height: DEC("0.15243243243243243"),
      },
      {
        x: DEC("0.0762162162162162"),
        y: DEC("0.3194594594594594"),
        width: DEC("0.1524324324324324"),
        height: DEC("0.508108108108108"),
      },
      {
        x: DEC("0.025405405405405396"),
        y: DEC("0.8475675675675675"),
        width: DEC("0.254054054054054"),
        height: DEC("0.15243243243243243"),
      },
    ],
  },
  {
    id: "horizontal-2",
    label: "A1*G5",
    node: {
      type: "group",
      layout: "horizontal",
      children: [
        { type: "glyph", id: "A1", sizeOverride: null },
        { type: "glyph", id: "G5", sizeOverride: null },
      ],
    },
    expected: {
      width: 1,
      height: DEC("0.632258064516129"),
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0, y: 0, width: DEC("0.47419354838709676"), height: DEC("0.632258064516129") },
      {
        x: DEC("0.4941935483870968"),
        y: 0,
        width: DEC("0.5058064516129032"),
        height: DEC("0.632258064516129"),
      },
    ],
  },
  {
    id: "fallback-b1-n1",
    label: "B1:N1",
    node: {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "B1", sizeOverride: null },
        { type: "glyph", id: "N1", sizeOverride: null },
      ],
    },
    expected: {
      width: 0.3675,
      height: 1,
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0, y: 0, width: 0.3675, height: 0.49 },
      { x: 0, y: 0.51, width: 0.3675, height: 0.49 },
    ],
  },
  {
    id: "vertical-small-z1",
    label: "Z1:Z1:Z1",
    node: {
      type: "group",
      layout: "vertical",
      children: [
        { type: "glyph", id: "Z1", sizeOverride: null },
        { type: "glyph", id: "Z1", sizeOverride: null },
        { type: "glyph", id: "Z1", sizeOverride: null },
      ],
    },
    expected: {
      width: 0.4,
      height: 1,
      lastEdge: 1,
    },
    referenceChildren: [
      { x: 0, y: 0, width: 0.4, height: 0.08 },
      { x: 0, y: 0.46, width: 0.4, height: 0.08 },
      { x: 0, y: 0.92, width: 0.4, height: 0.08 },
    ],
  },
];
