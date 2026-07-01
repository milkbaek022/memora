import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface PackageJson {
  scripts?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(apiRoot, "package.json"), "utf8")) as PackageJson;
}

describe("api package scripts", () => {
  it("does not point the dev script at a missing entry file", () => {
    const devScript = readPackageJson().scripts?.dev ?? "";
    expect(devScript).toBe("tsx src/index.ts");

    const target = devScript.match(/^tsx\s+(.+)$/)?.[1];
    expect(target).toBeDefined();
    expect(existsSync(resolve(apiRoot, target ?? ""))).toBe(true);
  });

  it("defines a production start script for the compiled API", () => {
    const startScript = readPackageJson().scripts?.start ?? "";

    expect(startScript).toBe("node dist/index.js");
  });
});
