import { chromium, expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("extension loads in Chromium", async () => {
  const extensionPath = path.resolve("apps/extension/dist");
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "memora-extension-"));
  const browserHome = path.join(userDataDir, "home");
  const browserCache = path.join(userDataDir, "cache");
  await fs.mkdir(browserHome, { recursive: true });
  await fs.mkdir(browserCache, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.MEMORA_E2E_HEADLESS === "1",
    env: {
      ...process.env,
      HOME: browserHome,
      XDG_CACHE_HOME: browserCache,
      XDG_CONFIG_HOME: browserHome
    },
    args: [
      "--disable-crash-reporter",
      "--disable-crashpad",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const page = await context.newPage();
    await page.goto(`file://${path.resolve("e2e/fixtures/sample-article.html")}`);

    const background =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    expect(background).toBeTruthy();
  } finally {
    await context.close();
    await fs.rm(userDataDir, { force: true, recursive: true });
  }
});
