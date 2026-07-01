import type { AppConfig } from "../config";
import { DeepSeekChatProvider } from "./deepseekProvider";
import { MockAiProvider } from "./mockProvider";
import { OpenAiResponsesProvider } from "./openaiProvider";
import type { AiProvider } from "./provider";

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
