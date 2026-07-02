import type { AppConfig } from "../config.js";
import { DeepSeekChatProvider } from "./deepseekProvider.js";
import { MockAiProvider } from "./mockProvider.js";
import { OpenAiResponsesProvider } from "./openaiProvider.js";
import type { AiProvider } from "./provider.js";

export function createConfiguredAiProvider(config: AppConfig): AiProvider {
  if (config.aiProvider === "openai") {
    return new OpenAiResponsesProvider({
      apiKey: config.openAiApiKey,
      model: config.openAiModel
    });
  }

  if (config.aiProvider === "deepseek") {
    return new DeepSeekChatProvider({
      apiKey: config.deepSeekApiKey,
      model: config.deepSeekModel,
      baseUrl: config.deepSeekBaseUrl
    });
  }

  return new MockAiProvider();
}
