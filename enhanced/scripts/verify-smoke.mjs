/* --------------------------------------------------------------------------
 *  Headless smoke test for the editor.
 *
 *  Drives a real Chromium against the running dev server. Exercises:
 *
 *    1. Drag-selecting across Latin + hieroglyph in the editor pane
 *       picks up the full range as one contiguous text selection.
 *    2. Group V / Group H / Ungroup mutate the editor's text the way
 *       commands.ts says they should.
 *    3. Cartouche popover offers multiple variants and switches
 *       between them on click.
 *    4. Rotate popover applies arbitrary angles, not just presets.
 *    5. The Preview pane renders a HieroJax SVG for any contiguous
 *       hieroglyph run, plus reflects rotation.
 *
 *  Usage: `bun scripts/verify-smoke.mjs [http://localhost:5173]`.
 *  Saves a screenshot at scripts/_smoke-final.png.
 * ------------------------------------------------------------------------ */

import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const URL = process.argv[2] ?? "http://localhost:5173";
const HEADLESS = process.env.HEADLESS !== "false";

const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

const findChrome = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error(
    "Couldn't find Chromium/Chrome — set PUPPETEER_EXECUTABLE_PATH.",
  );
};

const log = (...args) => console.log("[smoke]", ...args);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve a doc-position range covering an exact substring of the
 *  ENTIRE doc text — works across text-node boundaries (which marks
 *  introduce). Throws if the substring isn't found. */
const SELECT_RANGE_FN = `(needle) => {
  const ed = window.__lotusEditor;
  const positions = [];
  let flat = "";
  ed.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (let i = 0; i < node.text.length; i++) {
      flat += node.text[i];
      positions.push(pos + i);
    }
  });
  const idx = flat.indexOf(needle);
  if (idx < 0) throw new Error('substring not found: ' + JSON.stringify(needle));
  const from = positions[idx];
  const to = positions[idx + needle.length - 1] + 1;
  ed.commands.setTextSelection({ from, to });
  return { from, to };
}`;

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("pageerror", (e) => {
    pageErrors.push(e.message);
    console.error("[page error]", e.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.error("[console]", msg.text());
    }
  });

  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.waitForSelector(".lotus-editor");
  await page.waitForFunction(() => !!window.__lotusEditor, { timeout: 5000 });
  log("editor mounted");

  // 1. Replace the doc with known content.
  await page.evaluate(() => {
    const ed = window.__lotusEditor;
    ed.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "ABC 𓀀𓁹𓅓𓏏 XYZ" }],
        },
      ],
    });
  });

  // 2. Drag-select across Latin + hieroglyph by substring.
  const sel1 = await page.evaluate(`(${SELECT_RANGE_FN})("BC 𓀀𓁹")`);
  log("selection 1", sel1);
  const sel1Text = await page.evaluate(() => {
    const s = window.__lotusEditor.state.selection;
    return window.__lotusEditor.state.doc.textBetween(s.from, s.to, "");
  });
  log("selection 1 text", JSON.stringify(sel1Text));
  if (sel1Text !== "BC 𓀀𓁹")
    throw new Error("Latin+hieroglyph selection failed: " + JSON.stringify(sel1Text));

  // 3. Group V on the four hieroglyphs.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀𓁹𓅓𓏏")`);
  await page.click('button[title^="Stack selected glyphs vertically"]');
  await sleep(120);
  const docTextV = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Group V", JSON.stringify(docTextV));
  if (!docTextV.includes("\u{13430}"))
    throw new Error("vertical joiner missing after Group V");

  // 4. Toggle to Group H.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀\u{13430}𓁹\u{13430}𓅓\u{13430}𓏏")`);
  await page.click('button[title^="Place selected glyphs horizontally"]');
  await sleep(120);
  const docTextH = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Group H", JSON.stringify(docTextH));
  if (docTextH.includes("\u{13430}"))
    throw new Error("vertical joiner still present after Group H");
  if (!docTextH.includes("\u{13431}"))
    throw new Error("horizontal joiner missing after Group H");

  // 5. Cartouche popover — open and click "Royal cartouche".
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀\u{13431}𓁹\u{13431}𓅓\u{13431}𓏏")`);
  await page.click('button[title="Wrap selection in a cartouche"]');
  await page.waitForSelector(".cartouche-popover");
  log("cartouche popover open");
  await page.click('.cartouche-popover__tile[title="Royal cartouche"]');
  await sleep(150);
  const docTextRoyal = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Royal cartouche", JSON.stringify(docTextRoyal));
  if (!docTextRoyal.includes("\u{13379}\u{1343C}"))
    throw new Error("royal cartouche prefix missing");
  if (!docTextRoyal.includes("\u{1343D}\u{1337A}"))
    throw new Error("royal cartouche suffix missing");

  // 6. Switch to "Plain enclosure" — should re-wrap, not double-wrap.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀\u{13431}𓁹\u{13431}𓅓\u{13431}𓏏")`);
  await page.click('button[title="Wrap selection in a cartouche"]');
  await page.waitForSelector(".cartouche-popover");
  await page.click('.cartouche-popover__tile[title="Plain enclosure"]');
  await sleep(150);
  const docTextPlain = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Plain enclosure", JSON.stringify(docTextPlain));
  if (docTextPlain.includes("\u{13379}"))
    throw new Error("royal caps still present after switching to plain enclosure");
  if (!docTextPlain.includes("\u{1343C}"))
    throw new Error("plain enclosure begin missing");
  if (!docTextPlain.includes("\u{1343D}"))
    throw new Error("plain enclosure end missing");

  // 6b. Switch to "Hwt frame" — adds O006a/d corner caps around the
  //     plain enclosure controls.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀\u{13431}𓁹\u{13431}𓅓\u{13431}𓏏")`);
  await page.click('button[title="Wrap selection in a cartouche"]');
  await page.waitForSelector(".cartouche-popover");
  // Wait for the cartouche tile previews to finish rendering so the
  // popover-open screenshot below captures real SVG samples.
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        ".cartouche-popover__tile .cartouche-popover__sample svg",
      ).length >= 5,
    { timeout: 4000 },
  );
  await page.screenshot({
    path: resolve(__dirname, "_cartouche-popover.png"),
    clip: await page.evaluate(() => {
      const el = document.querySelector(".cartouche-popover");
      const r = el.getBoundingClientRect();
      return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
    }),
  });
  log("cartouche popover screenshot saved");
  await page.click('.cartouche-popover__tile[title="Hwt frame"]');
  await sleep(150);
  const docTextHwt = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Hwt frame", JSON.stringify(docTextHwt));
  if (!docTextHwt.includes("\u{13258}\u{1343C}"))
    throw new Error("hwt frame open caps missing");
  if (!docTextHwt.includes("\u{1343D}\u{1325B}"))
    throw new Error("hwt frame close caps missing");

  // 6c. Switch to "Serekh" — strips the hwt corners, keeps the
  //     walled enclosure as a bare palace-facade rectangle.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀\u{13431}𓁹\u{13431}𓅓\u{13431}𓏏")`);
  await page.click('button[title="Wrap selection in a cartouche"]');
  await page.waitForSelector(".cartouche-popover");
  await page.click('.cartouche-popover__tile[title="Serekh"]');
  await sleep(150);
  const docTextSerekh = await page.evaluate(() =>
    window.__lotusEditor.state.doc.textBetween(0, window.__lotusEditor.state.doc.content.size, "\n"),
  );
  log("after Serekh", JSON.stringify(docTextSerekh));
  if (docTextSerekh.includes("\u{13258}"))
    throw new Error("hwt caps still present after switching to serekh");
  if (!docTextSerekh.includes("\u{1343E}"))
    throw new Error("walled enclosure begin missing");
  if (!docTextSerekh.includes("\u{1343F}"))
    throw new Error("walled enclosure end missing");

  // 7. Verify HieroJax rendered SVG in preview.
  await page.waitForFunction(
    () => document.querySelector(".preview__host .hierojax svg") != null,
    { timeout: 4000 },
  );
  log("preview SVG rendered");

  // 8. Open Rotate popover, type 137 in number input, blur to commit.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓀀")`);
  await page.click('button[title="Rotate selected glyphs"]');
  await page.waitForSelector(".rotate-popover");
  log("rotate popover open");
  // Clear and type a non-preset value via the number input.
  await page.click("#rotate-popover-num", { count: 3 });
  await page.keyboard.type("137");
  await page.keyboard.press("Enter");
  await sleep(150);
  const rotation137 = await page.evaluate(() => {
    const ed = window.__lotusEditor;
    let deg = 0;
    ed.state.doc.descendants((n) => {
      const m = n.marks?.find((mm) => mm.type.name === "hieroRotation");
      if (m) deg = m.attrs.degrees;
    });
    return deg;
  });
  log("rotation after typing 137", rotation137);
  if (rotation137 !== 137) throw new Error("rotation 137 not applied");

  // 9. Click 90° preset chip — should switch to 90. The popover is
  //    still open from step 8 (Enter doesn't close it on purpose so
  //    users can chain adjustments), so we just click the chip.
  await page.waitForSelector(".rotate-popover");
  const presetClicked = await page.evaluate(() => {
    const buttons = [
      ...document.querySelectorAll(".rotate-popover__preset"),
    ];
    const btn = buttons.find((b) => b.textContent?.trim() === "90°");
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!presetClicked) throw new Error("90° preset not found in popover");
  await sleep(150);
  // Close the rotate popover by pressing Escape so subsequent clicks
  // on toolbar buttons don't get intercepted by outside-click logic.
  await page.keyboard.press("Escape");
  await sleep(50);
  const rotation90 = await page.evaluate(() => {
    const ed = window.__lotusEditor;
    let deg = 0;
    ed.state.doc.descendants((n) => {
      const m = n.marks?.find((mm) => mm.type.name === "hieroRotation");
      if (m) deg = m.attrs.degrees;
    });
    return deg;
  });
  log("rotation after 90° preset", rotation90);
  if (rotation90 !== 90) throw new Error("90° preset did not commit");
  await page.waitForFunction(
    () => document.querySelector(".preview__host .hiero-rot") != null,
    { timeout: 2000 },
  );
  log("rotated span in preview");

  // 10. Color popover — pick a preset, then verify the mark exists
  //     AND the rendered SVG glyph picked up the chosen fill.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓁹")`);
  await page.click('button[title="Color selected text"]');
  await page.waitForSelector(".color-popover");
  log("color popover open");
  await page.click('.color-popover__swatch[title="Red"]');
  await sleep(180);
  const colorMark = await page.evaluate(() => {
    const ed = window.__lotusEditor;
    let value = null;
    ed.state.doc.descendants((n) => {
      const m = n.marks?.find((mm) => mm.type.name === "hieroColor");
      if (m) value = m.attrs.color;
    });
    return value;
  });
  log("color mark after preset", colorMark);
  if (typeof colorMark !== "string" || !/^#a93729$/i.test(colorMark))
    throw new Error("red color mark not applied: " + JSON.stringify(colorMark));
  await page.keyboard.press("Escape");
  await sleep(60);
  // HieroJax bakes signcolor into the SVG `fill` — check that some
  // `<tspan class="hierojax-svg-sign">` inherited our red.
  await page.waitForFunction(
    () => {
      const spans = document.querySelectorAll(
        ".preview__host .hierojax-svg-sign, .preview__host .hierojax-svg-visual",
      );
      for (const s of spans) {
        const f = (s.getAttribute("fill") || "").toLowerCase();
        if (f === "#a93729") return true;
      }
      return false;
    },
    { timeout: 4000 },
  );
  log("red fill present on preview SVG");

  // 11. Clear color — mark should disappear.
  await page.evaluate(`(${SELECT_RANGE_FN})("𓁹")`);
  await page.click('button[title="Color selected text"]');
  await page.waitForSelector(".color-popover");
  await page.click(".color-popover__clear");
  await sleep(180);
  const colorAfterClear = await page.evaluate(() => {
    const ed = window.__lotusEditor;
    let value = null;
    ed.state.doc.descendants((n) => {
      const m = n.marks?.find((mm) => mm.type.name === "hieroColor");
      if (m) value = m.attrs.color;
    });
    return value;
  });
  log("color mark after clear", colorAfterClear);
  if (colorAfterClear != null)
    throw new Error("color mark survived clear: " + JSON.stringify(colorAfterClear));
  await page.keyboard.press("Escape");
  await sleep(60);

  // 12. Vertical preview toggle.
  await page.click('button[title^="Render preview vertically"]');
  await sleep(200);
  const previewDir = await page.$eval(".preview", (el) =>
    el.getAttribute("data-vertical-mode"),
  );
  log("vertical preview", previewDir);
  if (previewDir !== "true")
    throw new Error("vertical preview did not toggle");

  await page.screenshot({
    path: resolve(__dirname, "_smoke-final.png"),
    fullPage: true,
  });
  log("screenshot saved");

  await browser.close();

  if (pageErrors.length || consoleErrors.length) {
    console.error("[smoke] PAGE / CONSOLE ERRORS DETECTED");
    process.exit(1);
  }
  log("OK");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
