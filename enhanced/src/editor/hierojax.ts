/* --------------------------------------------------------------------------
 *  Thin TypeScript surface over the vendored HieroJax (GPL-3.0) library.
 *
 *  HieroJax exposes itself as two window globals:
 *
 *    window.hierojax  — instance of the HieroJax class, with:
 *      .processFragment(elem)      render one .hierojax span
 *      .processFragmentsIn(root)   render every .hierojax descendant
 *      .processFragments()         render every .hierojax on the page
 *      .waitForFonts(cb)           call cb once NewGardiner.otf is ready
 *      .fonts / .nFontsLoaded      font-loading state
 *
 *    window.syntax    — generated PEG parser; we only use it for early
 *                       validation of user input.
 *
 *  Everything that touches those globals goes through THIS file so the
 *  rest of the app stays TypeScript-clean and the GPL boundary is
 *  obvious (anything imported from here ultimately runs HieroJax code).
 *
 *  Why a class wrapper? The TipTap NodeView re-renders frequently. We
 *  don't want to ship a render call before HieroJax finishes loading
 *  the font — that races and produces empty SVG. `whenReady` lets the
 *  NodeView park its first render until the library is fully alive.
 * ------------------------------------------------------------------------ */

interface HieroJaxInstance {
  processFragment(elem: HTMLElement): void;
  processFragmentsIn(elem: HTMLElement): void;
  processFragments(): void;
  waitForFonts(cb: () => void, count?: number): void;
  fonts: unknown[];
  nFonts: number;
  nFontsLoaded: number;
}

interface SyntaxParser {
  parse(text: string): unknown;
}

declare global {
  interface Window {
    hierojax?: HieroJaxInstance;
    syntax?: SyntaxParser;
  }
}

/** Resolve when HieroJax has registered NewGardiner.otf with the
 *  document's font set. Reject after ~10s so a missing/broken vendor
 *  asset surfaces quickly instead of leaving the UI silent. */
export const whenReady = (): Promise<HieroJaxInstance> =>
  new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      const hj = window.hierojax;
      if (hj && hj.nFontsLoaded >= hj.nFonts) {
        resolve(hj);
        return;
      }
      if (performance.now() - start > 10_000) {
        reject(
          new Error(
            "HieroJax did not finish loading within 10s — is /hierojax/hierojax.js included in index.html?",
          ),
        );
        return;
      }
      // HieroJax itself polls at 5/50/100/1000ms; we use a steady
      // interval since we're not in HieroJax's own polling loop.
      setTimeout(tick, 50);
    };
    tick();
  });

/** Render a single `<span class="hierojax">` element in place.
 *  Safe to call on a span that's already rendered — HieroJax wipes
 *  its own previous output before drawing. */
export const renderFragment = (elem: HTMLElement) => {
  window.hierojax?.processFragment(elem);
};

/** Parse without rendering — used to validate user-edited text
 *  before we commit it to the doc. Returns `true` if syntactically
 *  valid, otherwise the error message. */
export const tryParse = (text: string): true | string => {
  const parser = window.syntax;
  if (!parser) return "HieroJax not loaded";
  try {
    parser.parse(text);
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};
