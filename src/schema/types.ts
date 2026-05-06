export interface GlyphNode {
  type: "glyph";
  id: string;
  sizeOverride: number | null;
}

export interface GroupNode {
  type: "group";
  layout: "vertical" | "horizontal";
  children: Array<GlyphNode | GroupNode>;
}

export interface CadratNode {
  type: "cadrat";
  child: GlyphNode | GroupNode;
}

export interface PositionedChild {
  node: GlyphNode | GroupNode;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
}

export interface ComputedLayout {
  width: number;
  height: number;
  children: PositionedChild[];
}

export interface GlyphMetadata {
  code: string;
  aliases: string[];
  naturalWidth: number;
  naturalHeight: number;
  defaultRelativeSize: number;
}
