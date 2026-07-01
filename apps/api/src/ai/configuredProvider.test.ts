import { describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { DeepSeekChatProvider } from "./deepseekProvider";
import { MockAiProvider } from "./mockProvider";
import { OpenAiResponsesProvider } from "./openaiProvider";
import { createConfiguredAiProvider } from "./configuredProvider";

describe("createConfiguredAiProvider", () => {
  it("creates the provider selected by configuration", () => {
    expect(createConfiguredAiProvider(loadConfig({ AI_PROVIDER: "mock" }))).toBeInstanceOf(
      MockAiProvider
    );
    expect(
      createConfiguredAiProvider(
        loadConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "key", OPENAI_MODEL: "model" })
      )
    ).toBeInstanceOf(OpenAiResponsesProvider);
    expect(
      createConfiguredAiProvider(
        loadConfig({ AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key", DEEPSEEK_MODEL: "model" })
      )
    ).toBeInstanceOf(DeepSeekChatProvider);
  });
});
