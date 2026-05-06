import type { GlyphMetadata } from "../schema/types";

export const DEFAULT_GLYPH_METADATA: GlyphMetadata = {
  code: "__default__",
  aliases: [],
  naturalWidth: 0.75,
  naturalHeight: 1.0,
  defaultRelativeSize: 100,
};

export function resolveGlyphMetadata(
  glyphId: string,
  db: Map<string, GlyphMetadata>,
): GlyphMetadata {
  const direct = db.get(glyphId);
  if (direct) return direct;

  const upper = glyphId.toUpperCase();
  const upperMatch = db.get(upper);
  if (upperMatch) return upperMatch;

  return {
    ...DEFAULT_GLYPH_METADATA,
    code: glyphId,
  };
}
