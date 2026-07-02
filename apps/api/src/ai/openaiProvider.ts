import type { FeynmanFeedback, LearningContent, ValidationResult } from "@memora/shared";
import { validateFeynmanFeedback, validateLearningContent } from "@memora/shared";
import { ApiError } from "../invites/inviteService.js";
import { buildFeynmanPrompt, buildLearningPrompt } from "./prompts.js";
import type { AiProvider, FeynmanGenerationInput, LearningGenerationInput } from "./provider.js";
import { feedbackSchema, jsonSchemaForMode } from "./structuredSchemas.js";

interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
}

interface OpenAiOutputTextContent {
  type: "output_text";
  text: string;
}

interface OpenAiOutputItem {
  content?: Array<OpenAiOutputTextContent | { type: string }>;
}

interface OpenAiResponsePayload {
  output?: OpenAiOutputItem[];
  output_text?: string;
}

function readOutputText(payload: OpenAiResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const contentText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find(
      (content): content is OpenAiOutputTextContent =>
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string" &&
        content.text.trim().length > 0
    )
    ?.text;

  if (contentText) {
    return contentText;
  }

  throw new Error("OpenAI response did not include output_text.");
}

export class OpenAiResponsesProvider implements AiProvider {
  constructor(private options: OpenAiProviderOptions) {}

  async generateLearningContent(input: LearningGenerationInput): Promise<LearningContent> {
    const parsed = await this.requestJson(
      buildLearningPrompt(input),
      "learning_content",
      jsonSchemaForMode(input.mode)
    );
    const validation: ValidationResult = validateLearningContent(input.mode, parsed);
    if (validation.ok === false) throw new ApiError(validation.code, 502, validation.message);
    return parsed as LearningContent;
  }

  async generateFeynmanFeedback(input: FeynmanGenerationInput): Promise<FeynmanFeedback> {
    const parsed = await this.requestJson(
      buildFeynmanPrompt(input),
      "feynman_feedback",
      feedbackSchema
    );
    const validation: ValidationResult = validateFeynmanFeedback(parsed);
    if (validation.ok === false) throw new ApiError(validation.code, 502, validation.message);
    return parsed as FeynmanFeedback;
  }

  private async requestJson(
    prompt: string,
    schemaName: string,
    schema: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.options.apiKey || !this.options.model) {
      throw new Error("OpenAI provider requires OPENAI_API_KEY and OPENAI_MODEL.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.options.model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema,
            strict: true
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const data = (await response.json()) as OpenAiResponsePayload;
    return JSON.parse(readOutputText(data));
  }
}
