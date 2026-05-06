import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function login() {
  await page.goto("http://localhost:3001/auth/login", { waitUntil: "networkidle" });
  await page.locator('input[name="username"], input[type="text"]').first().fill("ibramqa");
  await page.locator('input[name="password"], input[type="password"]').first().fill("225825588iI");
  await page.getByRole("button", { name: /login|sign in/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.goto("http://localhost:3001/writing", { waitUntil: "networkidle" });
}

async function clearEditor() {
  await page.evaluate(() => {
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor instanceof HTMLElement) {
      editor.innerHTML = "";
      editor.focus();
    }
  });
  await page.waitForTimeout(200);
}

async function insertFirstPaletteGlyph(count) {
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  const paletteItem = page.locator('div[draggable="true"]').filter({
    has: page.locator("svg"),
  }).first();
  for (let i = 0; i < count; i += 1) {
    await paletteItem.dblclick();
    await page.waitForTimeout(150);
  }
}

async function selectAllEditorGlyphs() {
  const icons = page.locator('[contenteditable="true"] .svg-icon');
  const count = await icons.count();
  for (let i = 0; i < count; i += 1) {
    await icons.nth(i).click();
    await page.waitForTimeout(100);
  }
}

async function groupAndMeasure() {
  await page.getByRole("button", { name: /^Group$/ }).click();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const merged = document.querySelector(
      '[contenteditable="true"] .svg-icon.merged',
    );
    if (!(merged instanceof HTMLElement)) return null;
    const wrapper = {
      width: parseFloat(merged.style.width || "0"),
      height: parseFloat(merged.style.height || "0"),
    };
    const slots = Array.from(merged.children).map((child) => {
      const el = child;
      if (!(el instanceof HTMLElement)) return null;
      return {
        left: parseFloat(el.style.left || "0"),
        top: parseFloat(el.style.top || "0"),
        width: parseFloat(el.style.width || "0"),
        height: parseFloat(el.style.height || "0"),
        right:
          parseFloat(el.style.left || "0") + parseFloat(el.style.width || "0"),
        bottom:
          parseFloat(el.style.top || "0") + parseFloat(el.style.height || "0"),
      };
    });
    return { wrapper, slots };
  });
}

try {
  await login();

  const results = {};

  await clearEditor();
  await insertFirstPaletteGlyph(4);
  await selectAllEditorGlyphs();
  results.A1 = await groupAndMeasure();

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
