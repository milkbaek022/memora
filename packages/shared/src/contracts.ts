export type LearningMode = "quick" | "deep" | "mastery";

export type ApiErrorCode =
  | "INVALID_INVITE"
  | "INVITE_DISABLED"
  | "UNAUTHORIZED"
  | "NO_QUOTA"
  | "INVALID_SELECTION"
  | "SELECTION_TOO_LONG"
  | "INVALID_CONCEPT"
  | "AI_FAILURE"
  | "MALFORMED_AI_RESPONSE"
  | "NON_CHINESE_OUTPUT"
  | "FEEDBACK_ALREADY_SUBMITTED"
  | "SESSION_NOT_FOUND"
  | "UNSUPPORTED_PAGE";

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ApiErrorCode; message: string };

export interface ConceptValidity {
  is_valid: boolean;
  reason: string;
}

export interface QuickContent {
  concept_validity: ConceptValidity;
  original_term: string;
  chinese_display_name: string;
  concept_type: string;
  background: string;
  plain_definition: string;
  simple_example: string;
  example_mapping: string;
}

export interface QuizOption {
  id: "A" | "B" | "C" | "D";
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: [QuizOption, QuizOption, QuizOption, QuizOption];
  correct_option_id: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface DeepContent extends QuickContent {
  key_points: string[];
  common_misunderstandings: string[];
  quiz: QuizQuestion[];
}

export interface MasteryContent extends DeepContent {
  feynman_prompt: string;
  expected_explanation_points: string[];
}

export type LearningContent = QuickContent | DeepContent | MasteryContent;

export interface FeynmanFeedback {
  understanding_score: number;
  what_is_clear: string;
  missing_or_wrong: string;
  better_explanation: string;
  next_question: string;
}

export interface ActivateInviteRequest {
  code: string;
}

export interface ActivateInviteResponse {
  token: string;
  remaining_credits: number;
}

export interface LearnRequest {
  selected_text: string;
  paragraph_context: string;
  page_title: string;
  page_url: string;
  mode: LearningMode;
}

export interface LearnResponse {
  session_id: string;
  remaining_credits: number;
  content: LearningContent;
}

export interface FeynmanFeedbackRequest {
  session_id: string;
  user_explanation: string;
}

export interface FeynmanFeedbackResponse {
  feedback: FeynmanFeedback;
}

const REQUIRED_QUICK_FIELDS: Array<keyof QuickContent> = [
  "concept_validity",
  "original_term",
  "chinese_display_name",
  "concept_type",
  "background",
  "plain_definition",
  "simple_example",
  "example_mapping"
];

const QUIZ_OPTION_IDS = ["A", "B", "C", "D"] as const;
const FEEDBACK_TEXT_FIELDS: Array<keyof Omit<FeynmanFeedback, "understanding_score">> = [
  "what_is_clear",
  "missing_or_wrong",
  "better_explanation",
  "next_question"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isQuizOptionId(value: unknown): value is QuizOption["id"] {
  return typeof value === "string" && QUIZ_OPTION_IDS.includes(value as QuizOption["id"]);
}

function isChineseGuidanceText(text: string): boolean {
  const cjkCount = Array.from(text).filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
  const latinWordCount = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
  return cjkCount >= 2 && cjkCount >= latinWordCount * 2;
}

function fieldText(value: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((field) => value[field])
    .filter(isNonEmptyString)
    .join("\n");
}

export function isChineseTextDominant(text: string): boolean {
  const cjkCount = Array.from(text).filter((char) =>
    /[\u3400-\u9fff]/u.test(char)
  ).length;
  const latinWordCount = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
  return cjkCount >= 8 && cjkCount >= latinWordCount * 2;
}

export function validateSelectedText(selectedText: string): ValidationResult {
  const normalized = selectedText.trim();
  if (normalized.length === 0) {
    return {
      ok: false,
      code: "INVALID_SELECTION",
      message: "请选择一个更具体的概念词。"
    };
  }
  if (normalized.length > 80) {
    return {
      ok: false,
      code: "SELECTION_TOO_LONG",
      message: "选中的内容太长，请选择一个更短的概念词。"
    };
  }
  return { ok: true };
}

export function validateLearningContent(
  mode: LearningMode,
  value: unknown
): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回格式不正确。" };
  }

  for (const field of REQUIRED_QUICK_FIELDS) {
    if (field === "concept_validity") {
      if (
        !isRecord(value.concept_validity) ||
        typeof value.concept_validity.is_valid !== "boolean" ||
        !isNonEmptyString(value.concept_validity.reason)
      ) {
        return {
          ok: false,
          code: "MALFORMED_AI_RESPONSE",
          message: "AI 返回缺少概念有效性判断。"
        };
      }
      continue;
    }
    if (!isNonEmptyString(value[field])) {
      return {
        ok: false,
        code: "MALFORMED_AI_RESPONSE",
        message: `AI 返回缺少字段：${field}`
      };
    }
  }

  const chineseText = fieldText(value, [
    "chinese_display_name",
    "concept_type",
    "background",
    "plain_definition",
    "simple_example",
    "example_mapping"
  ]);
  if (!isChineseTextDominant(chineseText)) {
    return { ok: false, code: "NON_CHINESE_OUTPUT", message: "学习内容必须使用中文输出。" };
  }

  if (mode === "quick") return { ok: true };

  if (!Array.isArray(value.key_points) || value.key_points.length < 3) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回缺少理解要点。" };
  }
  if (
    !Array.isArray(value.common_misunderstandings) ||
    value.common_misunderstandings.length < 2
  ) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回缺少常见误区。" };
  }
  const guidanceTextItems = [...value.key_points, ...value.common_misunderstandings];
  if (!guidanceTextItems.every(isNonEmptyString)) {
    return {
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 返回的理解要点和常见误区格式不正确。"
    };
  }
  if (!guidanceTextItems.every(isChineseGuidanceText)) {
    return {
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "理解要点和常见误区必须使用中文输出。"
    };
  }
  if (!Array.isArray(value.quiz) || value.quiz.length < 1 || value.quiz.length > 8) {
    return {
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 返回的选择题数量不正确。"
    };
  }

  for (const question of value.quiz) {
    if (
      !isRecord(question) ||
      !isNonEmptyString(question.question) ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      !isNonEmptyString(question.explanation)
    ) {
      return {
        ok: false,
        code: "MALFORMED_AI_RESPONSE",
        message: "AI 返回的选择题格式不正确。"
      };
    }
    const optionIds = question.options.map((option) => (isRecord(option) ? option.id : undefined));
    const hasExactOptionIds =
      optionIds.length === QUIZ_OPTION_IDS.length &&
      QUIZ_OPTION_IDS.every((id) => optionIds.includes(id)) &&
      new Set(optionIds).size === QUIZ_OPTION_IDS.length;
    if (!hasExactOptionIds || !isQuizOptionId(question.correct_option_id)) {
      return {
        ok: false,
        code: "MALFORMED_AI_RESPONSE",
        message: "AI 返回的选择题选项格式不正确。"
      };
    }
    if (!question.options.every((option) => isRecord(option) && isNonEmptyString(option.text))) {
      return {
        ok: false,
        code: "MALFORMED_AI_RESPONSE",
        message: "AI 返回的选择题选项格式不正确。"
      };
    }
    const quizText = `${question.question}\n${question.explanation}\n${question.options
      .map((option) => (isRecord(option) ? option.text : ""))
      .join("\n")}`;
    if (!isChineseTextDominant(quizText)) {
      return { ok: false, code: "NON_CHINESE_OUTPUT", message: "选择题必须使用中文输出。" };
    }
  }

  if (mode === "deep") return { ok: true };

  if (
    !isNonEmptyString(value.feynman_prompt) ||
    !Array.isArray(value.expected_explanation_points) ||
    value.expected_explanation_points.length < 3
  ) {
    return {
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 返回缺少费曼练习内容。"
    };
  }
  if (!value.expected_explanation_points.every(isNonEmptyString)) {
    return {
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 返回的费曼解释要点格式不正确。"
    };
  }
  if (!value.expected_explanation_points.every(isChineseGuidanceText)) {
    return {
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "费曼解释要点必须使用中文输出。"
    };
  }
  if (
    !isChineseTextDominant(
      `${value.feynman_prompt}\n${value.expected_explanation_points.join("\n")}`
    )
  ) {
    return { ok: false, code: "NON_CHINESE_OUTPUT", message: "费曼提示必须使用中文输出。" };
  }
  return { ok: true };
}

export function validateFeynmanFeedback(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 反馈格式不正确。" };
  }
  if (
    typeof value.understanding_score !== "number" ||
    value.understanding_score < 0 ||
    value.understanding_score > 100
  ) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 反馈缺少理解分数。" };
  }
  const text = fieldText(value, [
    "what_is_clear",
    "missing_or_wrong",
    "better_explanation",
    "next_question"
  ]);
  for (const field of FEEDBACK_TEXT_FIELDS) {
    if (!isNonEmptyString(value[field])) {
      return {
        ok: false,
        code: "MALFORMED_AI_RESPONSE",
        message: `AI 反馈缺少字段：${field}`
      };
    }
  }
  if (!isChineseTextDominant(text)) {
    return { ok: false, code: "NON_CHINESE_OUTPUT", message: "费曼反馈必须使用中文输出。" };
  }
  return { ok: true };
}
