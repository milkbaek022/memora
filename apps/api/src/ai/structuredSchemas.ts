import type { LearningMode } from "@memora/shared";

export function jsonSchemaForMode(mode: LearningMode): Record<string, unknown> {
  const quickProperties = {
    concept_validity: {
      type: "object",
      additionalProperties: false,
      required: ["is_valid", "reason"],
      properties: {
        is_valid: { type: "boolean" },
        reason: { type: "string" }
      }
    },
    original_term: { type: "string" },
    chinese_display_name: { type: "string" },
    concept_type: { type: "string" },
    background: { type: "string" },
    plain_definition: { type: "string" },
    simple_example: { type: "string" },
    example_mapping: { type: "string" }
  };

  const deepProperties = {
    ...quickProperties,
    key_points: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    common_misunderstandings: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    quiz: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "options", "correct_option_id", "explanation"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text"],
              properties: {
                id: { type: "string", enum: ["A", "B", "C", "D"] },
                text: { type: "string" }
              }
            }
          },
          correct_option_id: { type: "string", enum: ["A", "B", "C", "D"] },
          explanation: { type: "string" }
        }
      }
    }
  };

  const masteryProperties = {
    ...deepProperties,
    feynman_prompt: { type: "string" },
    expected_explanation_points: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } }
  };

  const properties =
    mode === "quick" ? quickProperties : mode === "deep" ? deepProperties : masteryProperties;

  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

export const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "understanding_score",
    "what_is_clear",
    "missing_or_wrong",
    "better_explanation",
    "next_question"
  ],
  properties: {
    understanding_score: { type: "number", minimum: 0, maximum: 100 },
    what_is_clear: { type: "string" },
    missing_or_wrong: { type: "string" },
    better_explanation: { type: "string" },
    next_question: { type: "string" }
  }
};
