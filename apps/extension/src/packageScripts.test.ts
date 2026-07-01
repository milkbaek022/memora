import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface PackageJson {
  scripts?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  return JSON.parse(
    readFileSync(resolve(extensionRoot, "package.json"), "utf8")
  ) as PackageJson;
}

describe("extension package scripts", () => {
  it("defines a Chrome Web Store package script that zips the dist contents", () => {
    const packageScript = readPackageJson().scripts?.["pack:store"] ?? "";

    expect(packageScript).toContain("npm run build");
    expect(packageScript).toContain("cd dist");
    expect(packageScript).toContain("../memora-chrome-extension.zip");
  });
});
