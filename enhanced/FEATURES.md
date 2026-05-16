# Lotus Editor — Features & Status

A checklist of every feature the hieroglyph editor needs to ship.

Legend:

- `[x]` — works end-to-end
- `[~]` — implemented but has known issues
- `[ ]` — not started

---

## Architecture (rewritten 2026-05-16)

The editor is now built on **HieroJax** (Mark-Jan Nederhof,
`github.com/nederhof/hierojax`, GPL-3.0), vendored at
`public/hierojax/`. HieroJax handles quadrat layout, cartouche frames,
joiners, insertions, rotations, damage marks, etc. — it implements the
full Unicode L2/21-248 format-control specification and ships the
NewGardiner.otf hieroglyph font.

Our codebase is the **shell around** HieroJax:

- `src/editor/HieroRun.ts` — one custom TipTap inline atom that owns
  a chunk of hieroglyph text (signs + format controls). Plus an
  `appendTransaction` plugin that auto-flows raw hieroglyph codepoints
  in plain text into adjacent HieroRun atoms.
- `src/editor/HieroRunView.tsx` — React NodeView that hands the run's
  text to `window.hierojax.processFragment`.
- `src/editor/hierojax.ts` — typed wrapper around the two HieroJax
  globals (`hierojax`, `syntax`). Single chokepoint = single GPL
  boundary.
- `src/editor/unicode.ts` — codepoint predicates + format-control
  constants (joiners, cartouche open/close).

The rest of the app (toolbar, palette, App shell) is unchanged.
Toolbar buttons are now string-edits on `HieroRun.glyphs` —
**`Group V`** inserts U+13430 between signs, **`Group H`** inserts
U+13431, **`Cartouche`** wraps in U+13379 … U+1337A, **`Ungroup`**
strips every format-control codepoint. No more CSS spaghetti.

---

## Core editor (TipTap / ProseMirror)

- [x] Native text selection, caret movement, undo / redo, copy / paste
- [x] Bold / italic toggles (TipTap marks — for Latin text)
- [x] LTR / RTL direction switch
- [x] Document-wide font-size slider (14–48px) — flows through to HieroJax via CSS
- [x] Empty-paragraph placeholder
- [x] Mixed Latin + hieroglyph text inside the same paragraph

## Hieroglyph rendering (HieroJax)

- [x] Solo signs render at the correct intrinsic size
- [x] Quadrats render with proper sign placement (HieroJax's job)
- [x] Cartouches with the correct oval frame (𓍹 … 𓍺)
- [x] Vertical / horizontal joiners (U+13430 / U+13431)
- [x] Auto-flow plugin: raw hieroglyph text → HieroRun atom (initial doc + on-paste)
- [x] Two adjacent HieroRun atoms auto-merge into one
- [x] Click a HieroRun → NodeSelection with selection highlight (outline on the wrapper, not the inner SVG, so HieroJax's negative-x rendering doesn't leak past the chrome)
- [x] Delete / backspace removes the run as a unit
- [x] Sub-glyph selection: click a single sign inside a quadrat → that sign gets highlighted (orange fill); shift-click another to extend the range. Toolbar commands operate on the sub-range when set.
- [x] Font-size slider re-renders every HieroRun at the new size (HieroJax bakes size into its SVG at render time; Editor-host effect calls `processFragmentsIn` on style changes)

## Glyph palette

- [x] 10 sample glyphs covering all 4 JSesh shape categories
- [x] Tiles grouped by type with Gardiner code label
- [x] Click tile → insert codepoint via `insertHieroglyphs` command
- [x] Drag tile → drop into editor at drop position (`text/plain` payload)
- [ ] Admin dashboard for managing the catalogue — out of scope for prototype

## Grouping & layout commands

- [x] Group V (vertical joiner). Whole run by default; sub-range only when one is active.
- [x] Group H (horizontal joiner). Same scope rules as Group V.
- [x] Ungroup (strip format controls). Restricted to the sub-range when one is active; otherwise the whole run.
- [x] Cartouche toggle (royal 𓍹 … 𓍺). Wraps the sub-range when set, otherwise the whole run; running on an already-wrapped range strips the cartouche.
- [x] **Run alignment: Top / Mid / Bot** — per-run CSS `vertical-align` (`text-top` / `middle` / `text-bottom`). Stored as an attribute on the HieroRun node, preserved across merges, reflected in the toolbar's active-button state. Default is `bottom` (matches JSesh & HieroJax).
- [ ] Cartouche shape picker (Unicode encodes several: walled, plain, …) — needs UI; the underlying codepoints are all in HieroJax
- [ ] Rotation (U+FE00…U+FE0F variation selectors, registered with Unicode) — HieroJax supports it; toolbar UI not wired yet

## Vertical mode

- [x] Toolbar button toggles a doc-level flag
- [x] HieroRun NodeView passes the flag through as `data-dir="vlr"` so HieroJax orients quadrats top-to-bottom
- [x] Latin text stays horizontal regardless

## Code quality

- [x] No custom CSS-grid layout for quadrats — HieroJax owns layout
- [x] No custom per-quadrat React component — one NodeView for all hieroglyph content
- [x] TypeScript strict, build passes, smoke test passes in ~3s
- [x] One file per concern; each under 300 lines
- [x] Headless smoke test (`scripts/verify-grouping.mjs`) asserts:
  - editor + HieroJax both loaded
  - hieroglyph text auto-flows into HieroRun atoms
  - HieroJax renders SVG (not just plain text)
  - Latin text stays plain text
  - palette insertion lands in a HieroRun
  - `groupHieroRun` inserts U+13430 joiners
  - `toggleCartouche` wraps in 𓍹 … 𓍺
  - real mousedown on a tspan sets `{from:i, to:i+1}` sub-selection + paints the orange highlight
  - `groupHieroRun` respects the sub-range (joiner only between selected signs)
  - font-size slider scales the SVG (verified by reading the rendered `<svg width>`)

## Performance / serialisation

- [x] Document round-trips through plain Unicode text (with format controls)
- [x] Copy / paste round-trips (HieroJax keeps hidden text inside the SVG for native text selection)
- [x] No SVG rasterisation, no PNG cache, no custom clipboard MIME
- [ ] Save / load to backend — admin-dashboard scope

## Licensing

- HieroJax is **GPL-3.0**. The vendored copy + LICENSE live in
  `public/hierojax/`. Combining our frontend code with HieroJax means
  the frontend should also be GPL-licensed when distributed. Server
  code is unaffected (GPL triggers on distribution, not use). The
  GPL boundary in our code is `src/editor/hierojax.ts` and the
  `<script>` include in `index.html`.

---

## Reported issues — fix log

- **2026-05-16** — Threw away the custom GlyphGroup / Cartouche /
  VerticalRun / Rotation extensions and their NodeViews. Months of
  CSS-grid layout fixes that never quite matched JSesh's output.
  Replaced with **one** HieroRun atom + HieroJax. Net change: ~1000
  lines deleted, ~400 added. Result quality is now bounded by
  HieroJax (a research-grade implementation of the Unicode spec)
  rather than by our own ability to recreate Egyptology layout
  rules in CSS.
- **2026-05-16** — HieroJax's bundled `main.js` does
  `const hierojax = new HieroJax()` at the top level of a non-module
  script; top-level `const` is **not** a property of `window`, so we
  appended a small re-export at the bottom of `public/hierojax/hierojax.js`
  to promote `hierojax` and `syntax` to `window` so the rest of the
  app can reach them.
- **2026-05-16** — HieroJax's bundled JS hardcodes
  `new FontFace('Hieroglyphic', 'url(NewGardiner.otf)')` with a
  relative path that resolves against the *document*, not the script.
  Patched the vendored file to use `/hierojax/NewGardiner.otf`.
- **2026-05-16** — ProseMirror's `appendTransaction` doesn't fire on
  the initial doc creation; raw hieroglyph text in the initial content
  stayed un-wrapped. Added an `onCreate` hook on the HieroRun
  extension that dispatches a meta-tagged transaction; the plugin
  treats that meta as a "force pass" trigger so the initial doc
  goes through auto-flow exactly once.
- **2026-05-16** — *"Can't select individual glyphs; size slider does
  nothing"*. Two distinct fixes:
  1. **Selection.** Added a `hieroSignSelection` ProseMirror plugin
     keyed to `(runPos, from, to)` sign-indices. NodeView delegates
     `mousedown` on the wrapper span (capture phase) to map a clicked
     tspan back to a sign index and dispatch `setHieroSignSelection`;
     shift-click extends the range. A MutationObserver re-applies the
     `--selected` class whenever HieroJax wholesale-replaces the SVG.
     Toolbar commands (`groupHieroRun`, `ungroupHieroRun`,
     `toggleCartouche`) now scope to that sub-range when set,
     falling back to whole-run behaviour otherwise.
  2. **Size.** HieroJax reads `font-size` off computed style at
     render time and bakes it into the SVG — CSS changes after the
     fact don't propagate. Added a `useEffect` in `Editor.tsx` keyed
     on `fontSize`/`verticalMode`/`direction` that calls
     `window.hierojax.processFragmentsIn(host)`, redrawing every
     `.hierojax` fragment whenever a style prop changes.
- **2026-05-16** — *"Add top/mid/bot run alignment."* HieroJax's own
  `data-align` only differentiates middle vs bottom (the codebase
  literally only checks `align == 'bottom'`), so we put the control
  one layer up: a new `align` attribute on the HieroRun node maps
  to CSS `vertical-align` on the NodeView wrapper (`text-top`,
  `middle`, `text-bottom`). Three toolbar buttons reflect & set the
  focused run's alignment. The auto-flow merge keeps the *left* run's
  alignment when collapsing two adjacent runs.
