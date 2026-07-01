import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("loads DeepSeek provider settings from environment variables", () => {
    expect(
      loadConfig({
        AI_PROVIDER: "deepseek",
        DEEPSEEK_API_KEY: "test-key",
        DEEPSEEK_MODEL: "deepseek-chat",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com"
      })
    ).toMatchObject({
      aiProvider: "deepseek",
      deepSeekApiKey: "test-key",
      deepSeekModel: "deepseek-chat",
      deepSeekBaseUrl: "https://api.deepseek.com"
    });
  });

  it("loads the main invite code with a stable default", () => {
    expect(loadConfig({}).mainInviteCode).toBe("MEMORA-MAIN");
    expect(loadConfig({ MEMORA_MAIN_INVITE_CODE: "SHUWEI-MAIN" }).mainInviteCode).toBe(
      "SHUWEI-MAIN"
    );
  });

  it("uses DATABASE_URL when deploying with Neon on Vercel", () => {
    expect(
      loadConfig({
        DATABASE_URL: "postgresql://user:pass@example.neon.tech/memora?sslmode=require"
      }).databaseUrl
    ).toBe("postgresql://user:pass@example.neon.tech/memora?sslmode=require");
  });
});
