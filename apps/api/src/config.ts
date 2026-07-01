export interface AppConfig {
  port: number;
  databasePath: string;
  mainInviteCode: string;
  aiProvider: "mock" | "openai" | "deepseek";
  openAiApiKey: string;
  openAiModel: string;
  deepSeekApiKey: string;
  deepSeekModel: string;
  deepSeekBaseUrl: string;
}

function aiProviderFromEnv(value: string | undefined): AppConfig["aiProvider"] {
  return value === "openai" || value === "deepseek" ? value : "mock";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? "8787"),
    databasePath: env.DATABASE_PATH ?? "data/ai-learning.sqlite",
    mainInviteCode: env.MEMORA_MAIN_INVITE_CODE ?? "MEMORA-MAIN",
    aiProvider: aiProviderFromEnv(env.AI_PROVIDER),
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    openAiModel: env.OPENAI_MODEL ?? "",
    deepSeekApiKey: env.DEEPSEEK_API_KEY ?? "",
    deepSeekModel: env.DEEPSEEK_MODEL ?? "deepseek-chat",
    deepSeekBaseUrl: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"
  };
}
