import type { GlyphMetadata } from "../schema/types";

const SEED_GLYPH_METADATA: GlyphMetadata[] = [
  {
    code: "A1",
    aliases: [],
    naturalWidth: 0.75,
    naturalHeight: 1.0,
    defaultRelativeSize: 100,
  },
  {
    code: "G5",
    aliases: [],
    naturalWidth: 0.8,
    naturalHeight: 1.0,
    defaultRelativeSize: 100,
  },
  {
    code: "N35",
    aliases: ["n"],
    naturalWidth: 0.6,
    naturalHeight: 0.25,
    defaultRelativeSize: 100,
  },
  {
    code: "D58",
    aliases: ["p"],
    naturalWidth: 0.5,
    naturalHeight: 0.3,
    defaultRelativeSize: 100,
  },
  {
    code: "M17",
    aliases: ["i"],
    naturalWidth: 0.3,
    naturalHeight: 1.0,
    defaultRelativeSize: 100,
  },
  {
    code: "X1",
    aliases: ["t"],
    naturalWidth: 0.5,
    naturalHeight: 0.3,
    defaultRelativeSize: 100,
  },
  {
    code: "Z1",
    aliases: [],
    naturalWidth: 0.4,
    naturalHeight: 0.08,
    defaultRelativeSize: 100,
  },
  {
    code: "W24",
    aliases: ["nw"],
    naturalWidth: 0.6,
    naturalHeight: 0.5,
    defaultRelativeSize: 100,
  },
  {
    code: "D21",
    aliases: ["r"],
    naturalWidth: 0.7,
    naturalHeight: 0.3,
    defaultRelativeSize: 100,
  },
  {
    code: "S29",
    aliases: ["s"],
    naturalWidth: 0.5,
    naturalHeight: 0.4,
    defaultRelativeSize: 100,
  },
];

export const seedGlyphMetadata = new Map<string, GlyphMetadata>();

SEED_GLYPH_METADATA.forEach((glyph) => {
  seedGlyphMetadata.set(glyph.code, glyph);
  glyph.aliases.forEach((alias) => {
    seedGlyphMetadata.set(alias, glyph);
  });
});
