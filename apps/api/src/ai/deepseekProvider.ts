import type { FeynmanFeedback, LearningContent } from "@memora/shared";
import { validateFeynmanFeedback, validateLearningContent } from "@memora/shared";
import { ApiError } from "../invites/inviteService";
import { buildFeynmanPrompt, buildLearningPrompt } from "./prompts";
import type { AiProvider, FeynmanGenerationInput, LearningGenerationInput } from "./provider";
import { feedbackSchema, jsonSchemaForMode } from "./structuredSchemas";

interface DeepSeekProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface DeepSeekChatPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function readMessageContent(payload: DeepSeekChatPayload): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }
  throw new ApiError("AI_FAILURE", 502, "DeepSeek 没有返回内容，请稍后重试。");
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // Fall through to the stable API error below.
      }
    }
    throw new ApiError("MALFORMED_AI_RESPONSE", 502, "AI 返回不是可解析的 JSON。");
  }
}

function messageFromProviderPayload(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const directMessage = record.message;
  if (typeof directMessage === "string" && directMessage.trim()) return directMessage.trim();

  const error = record.error;
  if (typeof error === "object" && error !== null) {
    const nestedMessage = (error as Record<string, unknown>).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage.trim();
  }

  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || "未知错误";
  const text = await response.text().catch(() => "");
  if (!text.trim()) return fallback;

  try {
    return messageFromProviderPayload(JSON.parse(text)) ?? text.trim();
  } catch {
    return text.trim();
  }
}

function promptWithSchema(prompt: string, schema: Record<string, unknown>): string {
  return `${prompt}

请严格只返回一个 JSON 对象，不要包含 Markdown、代码块或解释文字。
JSON 对象需要符合这个结构约束：
${JSON.stringify(schema)}`;
}

export class DeepSeekChatProvider implements AiProvider {
  private baseUrl: string;

  constructor(private options: DeepSeekProviderOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
  }

  async generateLearningContent(input: LearningGenerationInput): Promise<LearningContent> {
    const parsed = await this.requestJson(
      promptWithSchema(buildLearningPrompt(input), jsonSchemaForMode(input.mode))
    );
    const validation = validateLearningContent(input.mode, parsed);
    if (!validation.ok) throw new ApiError(validation.code, 502, validation.message);
    return parsed as LearningContent;
  }

  async generateFeynmanFeedback(input: FeynmanGenerationInput): Promise<FeynmanFeedback> {
    const parsed = await this.requestJson(promptWithSchema(buildFeynmanPrompt(input), feedbackSchema));
    const validation = validateFeynmanFeedback(parsed);
    if (!validation.ok) throw new ApiError(validation.code, 502, validation.message);
    return parsed as FeynmanFeedback;
  }

  private async requestJson(prompt: string): Promise<unknown> {
    if (!this.options.apiKey || !this.options.model) {
      throw new Error("DeepSeek provider requires DEEPSEEK_API_KEY and DEEPSEEK_MODEL.");
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });
    } catch {
      throw new ApiError(
        "AI_FAILURE",
        502,
        "DeepSeek 网络连接失败，请检查后端网络和 DEEPSEEK_BASE_URL。"
      );
    }

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new ApiError("AI_FAILURE", 502, `DeepSeek 请求失败（${response.status}）：${message}`);
    }

    const data = (await response.json()) as DeepSeekChatPayload;
    return parseJsonContent(readMessageContent(data));
  }
}
