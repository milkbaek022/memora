# Memora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Memora, a private-beta Chrome extension also called "Memora 记忆药水" in Chinese, that lets a user right-click a selected concept, open a right-side learning panel, generate Chinese learning content through a shared backend, answer multiple-choice questions, and submit one Feynman-style explanation feedback round.

**Architecture:** Use an npm workspace monorepo with three units: `packages/shared` for contracts and validators, `apps/api` for the Fastify backend with SQLite and AI orchestration, and `apps/extension` for the Manifest V3 Chrome extension. The backend owns invite-code quota, model calls, response validation, and persistence; the extension owns selection capture, side panel state, rendering, quiz interaction, and Feynman submission.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Fastify, better-sqlite3, React, Vite, Chrome Manifest V3, Playwright for extension smoke checks, OpenAI Responses API through server-side `fetch`, SQLite for private beta storage.

## Global Constraints

- Node.js version floor: `>=20.0.0`.
- Browser target: desktop Chrome with Manifest V3.
- Product name: `Memora`; Chinese product name: `Memora 记忆药水`.
- Output language: Simplified Chinese for explanations, quiz questions, quiz options, quiz explanations, Feynman prompts, and Feynman feedback, even when the selected concept is English.
- English selected terms: preserve the original term and include a natural Chinese display name when helpful.
- Context sent to the backend: selected concept, nearest paragraph, page title, and page URL only; do not send the full article in the MVP.
- Trigger: use a right-click context menu item, not a floating selection button.
- Quota: each invite code starts with 5 credits, displayed to users as 5 bottles of memory potion; each successful learning generation deducts exactly 1 credit and consumes 1 bottle; failed generations and Feynman feedback do not deduct credits.
- User-facing quota copy: use `还剩 N 瓶记忆药水`, never `还剩 N 次`.
- Feynman feedback: one feedback response per Mastery learning session in the MVP.
- Visual style: warm off-white `#F7F7F4`, white surfaces, soft gray `#E7E7E2`, near-black text `#1F1F1D`, muted gray `#8A8A84`, soft fluorescent green `#D9FF63`, soft red `#F36B6B`, restrained radii and light borders.
- Memory-potion bottle style: use a restrained halftone dot-matrix bottle icon with translucent blue-cyan / blue-green tones and sparse dark-blue dots; avoid cartoon fantasy bottles, thick outlines, sparkles, ornate props, and heavy decorative effects.
- Do not add payments, email login, Google login, admin dashboards, mobile support, or long-term learning analytics in this plan.

---

## File Structure

Create the repository as a focused npm workspace:

- `package.json`: root scripts and workspace declarations.
- `tsconfig.base.json`: shared TypeScript compiler settings.
- `vitest.workspace.ts`: test workspace configuration.
- `packages/shared/src/contracts.ts`: learning modes, API request/response types, content schemas, and lightweight runtime validators.
- `packages/shared/src/contracts.test.ts`: validator and language-rule tests.
- `apps/api/src/config.ts`: environment parsing and API configuration.
- `apps/api/src/db/database.ts`: SQLite connection helper and transaction wrapper.
- `apps/api/src/db/schema.ts`: table creation and seed helper.
- `apps/api/src/auth/tokens.ts`: invite-code token generation and hashing.
- `apps/api/src/auth/authMiddleware.ts`: bearer token parsing and invite-code lookup.
- `apps/api/src/invites/inviteService.ts`: invite-code activation.
- `apps/api/src/ai/prompts.ts`: Chinese-only learning and feedback prompts.
- `apps/api/src/ai/openaiProvider.ts`: server-side OpenAI Responses API adapter.
- `apps/api/src/ai/mockProvider.ts`: deterministic mock provider for tests and local demo.
- `apps/api/src/learning/learningService.ts`: learning generation, validation, persistence, and quota deduction.
- `apps/api/src/feynman/feynmanService.ts`: one-time Feynman feedback generation and persistence.
- `apps/api/src/server.ts`: Fastify route registration.
- `apps/api/src/index.ts`: production server entrypoint.
- `apps/api/src/**/*.test.ts`: backend tests scoped to each service.
- `apps/extension/manifest.json`: Chrome Manifest V3 extension config.
- `apps/extension/src/background.ts`: context menu creation, click handling, and side panel opening.
- `apps/extension/src/contentScript.ts`: selected text and paragraph extraction.
- `apps/extension/src/panel/App.tsx`: side panel app shell and state transitions.
- `apps/extension/src/panel/components/*.tsx`: focused UI components for invite gate, mode tabs, content sections, quiz, Feynman input, potion bottle icon, and errors.
- `apps/extension/src/panel/styles.css`: visual system and layout styles.
- `apps/extension/src/lib/apiClient.ts`: backend API client and token storage helpers.
- `apps/extension/src/lib/sessionStore.ts`: panel session state helpers.
- `apps/extension/src/**/*.test.tsx`: extension UI and extraction tests.
- `e2e/fixtures/sample-article.html`: local page for extension smoke tests.
- `e2e/extension-smoke.spec.ts`: Playwright smoke flow.
- `docs/development.md`: local setup, seed invite code, backend env vars, and extension loading steps.

---

### Task 1: Initialize Workspace and Shared Contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/contracts.ts`
- Create: `packages/shared/src/contracts.test.ts`

**Interfaces:**
- Produces: `LearningMode`, `LearningContent`, `QuickContent`, `DeepContent`, `MasteryContent`, `FeynmanFeedback`, `LearnRequest`, `LearnResponse`, `ApiErrorCode`, `validateSelectedText()`, `validateLearningContent()`, `validateFeynmanFeedback()`, `isChineseTextDominant()`.
- Consumes: no project interfaces.

- [ ] **Step 1: Create root workspace files**

Write `package.json`:

```json
{
  "name": "memora",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "workspaces": [
    "apps/api",
    "apps/extension",
    "packages/shared"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -b --pretty false"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

Write `vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared",
  "apps/api",
  "apps/extension"
]);
```

- [ ] **Step 2: Create shared package metadata**

Write `packages/shared/package.json`:

```json
{
  "name": "@memora/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/contracts.js",
  "types": "dist/contracts.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Write `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "composite": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing shared contract tests**

Write `packages/shared/src/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isChineseTextDominant,
  validateFeynmanFeedback,
  validateLearningContent,
  validateSelectedText
} from "./contracts";

describe("validateSelectedText", () => {
  it("accepts a short English concept", () => {
    expect(validateSelectedText("demand mining")).toEqual({ ok: true });
  });

  it("rejects empty selected text", () => {
    expect(validateSelectedText("   ")).toEqual({
      ok: false,
      code: "INVALID_SELECTION",
      message: "请选择一个更具体的概念词。"
    });
  });

  it("rejects overly long selected text", () => {
    const selectedText = "需求".repeat(50);
    expect(validateSelectedText(selectedText)).toEqual({
      ok: false,
      code: "SELECTION_TOO_LONG",
      message: "选中的内容太长，请选择一个更短的概念词。"
    });
  });
});

describe("validateLearningContent", () => {
  it("accepts quick content with Chinese explanation for English term", () => {
    const result = validateLearningContent("quick", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。"
    });

    expect(result.ok).toBe(true);
  });

  it("rejects English-only explanations", () => {
    const result = validateLearningContent("quick", {
      concept_validity: { is_valid: true, reason: "valid" },
      original_term: "demand mining",
      chinese_display_name: "demand mining",
      concept_type: "method",
      background: "This is used in product discovery.",
      plain_definition: "It means finding hidden needs.",
      simple_example: "A user wants a faster horse.",
      example_mapping: "The horse maps to the surface request."
    });

    expect(result).toEqual({
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "学习内容必须使用中文输出。"
    });
  });

  it("accepts mastery content with quiz and Feynman prompt", () => {
    const result = validateLearningContent("mastery", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。",
      key_points: ["先听表面说法", "继续追问真实目标", "围绕真实目标找方案"],
      common_misunderstandings: ["把用户原话当成最终需求", "只做用户说的功能"],
      quiz: [
        {
          id: "q1",
          question: "以下哪项最接近需求挖掘？",
          options: [
            { id: "A", text: "整理用户原话" },
            { id: "B", text: "追问背后的真实问题" },
            { id: "C", text: "直接排期开发" },
            { id: "D", text: "跳过用户研究" }
          ],
          correct_option_id: "B",
          explanation: "B 对，因为需求挖掘关注真实问题。"
        }
      ],
      feynman_prompt: "请用自己的话解释需求挖掘。",
      expected_explanation_points: ["表面需求", "真实问题", "更合适方案"]
    });

    expect(result.ok).toBe(true);
  });
});

describe("validateFeynmanFeedback", () => {
  it("accepts Chinese feedback", () => {
    expect(validateFeynmanFeedback({
      understanding_score: 82,
      what_is_clear: "你讲清楚了表面需求和真实需求的区别。",
      missing_or_wrong: "还可以补充如何继续追问。",
      better_explanation: "需求挖掘就是从用户说法里找到真正要解决的问题。",
      next_question: "如果用户说想要更多按钮，你会怎么追问？"
    }).ok).toBe(true);
  });
});

describe("isChineseTextDominant", () => {
  it("treats mixed original term plus Chinese explanation as Chinese dominant", () => {
    expect(isChineseTextDominant("demand mining 是需求挖掘，不是简单翻译用户原话。")).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run: `npm install`

Expected: dependencies install successfully.

Run: `npm run test --workspace @memora/shared`

Expected: FAIL because `packages/shared/src/contracts.ts` does not exist.

- [ ] **Step 5: Implement shared contracts and validators**

Write `packages/shared/src/contracts.ts`:

```ts
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fieldText(value: Record<string, unknown>, fields: string[]): string {
  return fields.map((field) => value[field]).filter(isNonEmptyString).join("\n");
}

export function isChineseTextDominant(text: string): boolean {
  const cjkCount = Array.from(text).filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
  const latinWordCount = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
  return cjkCount >= 8 && cjkCount >= latinWordCount * 2;
}

export function validateSelectedText(selectedText: string): ValidationResult {
  const normalized = selectedText.trim();
  if (normalized.length === 0) {
    return { ok: false, code: "INVALID_SELECTION", message: "请选择一个更具体的概念词。" };
  }
  if (normalized.length > 80) {
    return { ok: false, code: "SELECTION_TOO_LONG", message: "选中的内容太长，请选择一个更短的概念词。" };
  }
  return { ok: true };
}

export function validateLearningContent(mode: LearningMode, value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回格式不正确。" };
  }

  for (const field of REQUIRED_QUICK_FIELDS) {
    if (field === "concept_validity") {
      if (!isRecord(value.concept_validity) || typeof value.concept_validity.is_valid !== "boolean" || !isNonEmptyString(value.concept_validity.reason)) {
        return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回缺少概念有效性判断。" };
      }
      continue;
    }
    if (!isNonEmptyString(value[field])) {
      return { ok: false, code: "MALFORMED_AI_RESPONSE", message: `AI 返回缺少字段：${field}` };
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
  if (!Array.isArray(value.common_misunderstandings) || value.common_misunderstandings.length < 2) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回缺少常见误区。" };
  }
  if (!Array.isArray(value.quiz) || value.quiz.length < 1 || value.quiz.length > 8) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回的选择题数量不正确。" };
  }

  for (const question of value.quiz) {
    if (!isRecord(question) || !isNonEmptyString(question.question) || !Array.isArray(question.options) || question.options.length !== 4 || !isNonEmptyString(question.explanation)) {
      return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回的选择题格式不正确。" };
    }
    if (!isChineseTextDominant(`${question.question}\n${question.explanation}\n${question.options.map((option) => isRecord(option) ? option.text : "").join("\n")}`)) {
      return { ok: false, code: "NON_CHINESE_OUTPUT", message: "选择题必须使用中文输出。" };
    }
  }

  if (mode === "deep") return { ok: true };

  if (!isNonEmptyString(value.feynman_prompt) || !Array.isArray(value.expected_explanation_points) || value.expected_explanation_points.length < 3) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 返回缺少费曼练习内容。" };
  }
  if (!isChineseTextDominant(`${value.feynman_prompt}\n${value.expected_explanation_points.join("\n")}`)) {
    return { ok: false, code: "NON_CHINESE_OUTPUT", message: "费曼提示必须使用中文输出。" };
  }
  return { ok: true };
}

export function validateFeynmanFeedback(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 反馈格式不正确。" };
  }
  if (typeof value.understanding_score !== "number" || value.understanding_score < 0 || value.understanding_score > 100) {
    return { ok: false, code: "MALFORMED_AI_RESPONSE", message: "AI 反馈缺少理解分数。" };
  }
  const text = fieldText(value, ["what_is_clear", "missing_or_wrong", "better_explanation", "next_question"]);
  if (!isChineseTextDominant(text)) {
    return { ok: false, code: "NON_CHINESE_OUTPUT", message: "费曼反馈必须使用中文输出。" };
  }
  return { ok: true };
}
```

- [ ] **Step 6: Run shared package verification**

Run: `npm run test --workspace @memora/shared`

Expected: PASS with all shared contract tests passing.

Run: `npm run lint --workspace @memora/shared`

Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.workspace.ts packages/shared
git commit -m "feat: add shared learning contracts"
```

---

### Task 2: Add API Project, Database Schema, and Invite Activation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/db/database.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/auth/tokens.ts`
- Create: `apps/api/src/invites/inviteService.ts`
- Create: `apps/api/src/invites/inviteService.test.ts`

**Interfaces:**
- Consumes: `ActivateInviteResponse` from `@memora/shared`.
- Produces: `createDatabase(path)`, `migrateDatabase(db)`, `seedInviteCode(db, code, credits)`, `activateInvite(db, code): ActivateInviteResponse`.

- [ ] **Step 1: Create API package metadata**

Write `apps/api/package.json`:

```json
{
  "name": "@memora/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@memora/shared": "0.1.0",
    "better-sqlite3": "^11.1.0",
    "fastify": "^4.28.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Write `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "composite": true
  },
  "references": [
    { "path": "../../packages/shared" }
  ],
  "include": ["src"]
}
```

- [ ] **Step 2: Write failing invite activation tests**

Write `apps/api/src/invites/inviteService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database";
import { migrateDatabase, seedInviteCode } from "../db/schema";
import { activateInvite } from "./inviteService";

describe("activateInvite", () => {
  it("activates an invite code and returns a reusable bearer token", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-001", 5);

    const result = activateInvite(db, "BETA-001");

    expect(result.remaining_credits).toBe(5);
    expect(result.token.length).toBeGreaterThan(32);
    const row = db.prepare("select activated_at, access_token_hash from invite_codes where code = ?").get("BETA-001") as { activated_at: string; access_token_hash: string };
    expect(row.activated_at).toEqual(expect.any(String));
    expect(row.access_token_hash.length).toBe(64);
  });

  it("rejects an unknown invite code", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);

    expect(() => activateInvite(db, "MISSING")).toMatchObject({
      code: "INVALID_INVITE",
      statusCode: 401
    });
  });

  it("rejects a disabled invite code", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-002", 5);
    db.prepare("update invite_codes set is_active = 0 where code = ?").run("BETA-002");

    expect(() => activateInvite(db, "BETA-002")).toMatchObject({
      code: "INVITE_DISABLED",
      statusCode: 403
    });
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run: `npm run test --workspace @memora/api -- src/invites/inviteService.test.ts`

Expected: FAIL because API files do not exist.

- [ ] **Step 4: Implement config, database, schema, token, and invite service**

Write `apps/api/src/config.ts`:

```ts
export interface AppConfig {
  port: number;
  databasePath: string;
  aiProvider: "mock" | "openai";
  openAiApiKey: string;
  openAiModel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? "8787"),
    databasePath: env.DATABASE_PATH ?? "data/ai-learning.sqlite",
    aiProvider: env.AI_PROVIDER === "openai" ? "openai" : "mock",
    openAiApiKey: env.OPENAI_API_KEY ?? "",
    openAiModel: env.OPENAI_MODEL ?? ""
  };
}
```

Write `apps/api/src/db/database.ts`:

```ts
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function createDatabase(path: string): AppDatabase {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
```

Write `apps/api/src/db/schema.ts`:

```ts
import type { AppDatabase } from "./database";

export function migrateDatabase(db: AppDatabase): void {
  db.exec(`
    create table if not exists invite_codes (
      id integer primary key autoincrement,
      code text not null unique,
      total_credits integer not null,
      remaining_credits integer not null,
      is_active integer not null default 1,
      access_token_hash text,
      created_at text not null default (datetime('now')),
      activated_at text,
      last_used_at text
    );

    create table if not exists learning_sessions (
      id text primary key,
      invite_code_id integer not null,
      selected_text text not null,
      paragraph_context text not null,
      page_title text not null,
      page_url text not null,
      mode text not null,
      ai_response_json text not null,
      credit_deducted integer not null,
      error_code text,
      created_at text not null default (datetime('now')),
      foreign key (invite_code_id) references invite_codes(id)
    );

    create table if not exists feynman_feedbacks (
      id text primary key,
      learning_session_id text not null unique,
      user_explanation text not null,
      ai_feedback_json text not null,
      created_at text not null default (datetime('now')),
      foreign key (learning_session_id) references learning_sessions(id)
    );
  `);
}

export function seedInviteCode(db: AppDatabase, code: string, credits = 5): void {
  db.prepare(`
    insert into invite_codes (code, total_credits, remaining_credits, is_active)
    values (?, ?, ?, 1)
    on conflict(code) do update set
      total_credits = excluded.total_credits,
      remaining_credits = excluded.remaining_credits,
      is_active = 1
  `).run(code, credits, credits);
}
```

Write `apps/api/src/auth/tokens.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

export function createAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

Write `apps/api/src/invites/inviteService.ts`:

```ts
import type { ActivateInviteResponse, ApiErrorCode } from "@memora/shared";
import type { AppDatabase } from "../db/database";
import { createAccessToken, hashAccessToken } from "../auth/tokens";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public statusCode: number, message: string) {
    super(message);
  }
}

interface InviteRow {
  id: number;
  code: string;
  remaining_credits: number;
  is_active: number;
}

export function activateInvite(db: AppDatabase, code: string): ActivateInviteResponse {
  const normalizedCode = code.trim();
  const row = db.prepare("select id, code, remaining_credits, is_active from invite_codes where code = ?").get(normalizedCode) as InviteRow | undefined;

  if (!row) {
    throw new ApiError("INVALID_INVITE", 401, "邀请码不存在。");
  }
  if (row.is_active !== 1) {
    throw new ApiError("INVITE_DISABLED", 403, "邀请码已停用。");
  }

  const token = createAccessToken();
  const tokenHash = hashAccessToken(token);
  db.prepare(`
    update invite_codes
    set access_token_hash = ?, activated_at = coalesce(activated_at, datetime('now')), last_used_at = datetime('now')
    where id = ?
  `).run(tokenHash, row.id);

  return {
    token,
    remaining_credits: row.remaining_credits
  };
}
```

- [ ] **Step 5: Run API invite tests**

Run: `npm run test --workspace @memora/api -- src/invites/inviteService.test.ts`

Expected: PASS with 3 invite activation tests.

Run: `npm run lint --workspace @memora/api`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat: add invite activation backend"
```

---

### Task 3: Add API Server, Auth Middleware, and Invite Route

**Files:**
- Create: `apps/api/src/auth/authMiddleware.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/server.test.ts`

**Interfaces:**
- Consumes: `activateInvite(db, code)`, `hashAccessToken(token)`.
- Produces: `buildServer({ db, aiProvider }): FastifyInstance`, authenticated request decoration `request.inviteCode`.

- [ ] **Step 1: Write failing route tests**

Write `apps/api/src/server.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDatabase } from "./db/database";
import { migrateDatabase, seedInviteCode } from "./db/schema";
import { buildServer } from "./server";

describe("server invite route", () => {
  it("activates invite code through HTTP", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-HTTP", 5);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "BETA-HTTP" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ remaining_credits: 5 });
    expect(response.json().token).toEqual(expect.any(String));
  });

  it("normalizes service errors into stable API errors", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "NOPE" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "INVALID_INVITE", message: "邀请码不存在。" }
    });
  });
});
```

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npm run test --workspace @memora/api -- src/server.test.ts`

Expected: FAIL because `buildServer` does not exist.

- [ ] **Step 3: Implement auth middleware and server**

Write `apps/api/src/auth/authMiddleware.ts`:

```ts
import type { FastifyRequest } from "fastify";
import type { AppDatabase } from "../db/database";
import { hashAccessToken } from "./tokens";
import { ApiError } from "../invites/inviteService";

export interface AuthenticatedInvite {
  id: number;
  code: string;
  remaining_credits: number;
}

declare module "fastify" {
  interface FastifyRequest {
    inviteCode?: AuthenticatedInvite;
  }
}

export function authenticateRequest(db: AppDatabase, request: FastifyRequest): AuthenticatedInvite {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", 401, "请先输入邀请码。");
  }

  const token = header.slice("Bearer ".length).trim();
  const tokenHash = hashAccessToken(token);
  const row = db.prepare(`
    select id, code, remaining_credits
    from invite_codes
    where access_token_hash = ? and is_active = 1
  `).get(tokenHash) as AuthenticatedInvite | undefined;

  if (!row) {
    throw new ApiError("UNAUTHORIZED", 401, "登录状态已失效，请重新输入邀请码。");
  }
  request.inviteCode = row;
  return row;
}
```

Write `apps/api/src/server.ts`:

```ts
import Fastify from "fastify";
import type { AppDatabase } from "./db/database";
import { authenticateRequest } from "./auth/authMiddleware";
import { activateInvite, ApiError } from "./invites/inviteService";

export interface ServerDependencies {
  db: AppDatabase;
}

export function buildServer({ db }: ServerDependencies) {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message }
      });
    }
    return reply.status(500).send({
      error: { code: "AI_FAILURE", message: "服务暂时不可用，请稍后重试。" }
    });
  });

  app.post("/api/invite/activate", async (request) => {
    const body = request.body as { code?: string };
    return activateInvite(db, body.code ?? "");
  });

  app.get("/api/me", async (request) => {
    const invite = authenticateRequest(db, request);
    return {
      code: invite.code,
      remaining_credits: invite.remaining_credits
    };
  });

  return app;
}
```

Write `apps/api/src/index.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config";
import { createDatabase } from "./db/database";
import { migrateDatabase } from "./db/schema";
import { buildServer } from "./server";

const config = loadConfig();
mkdirSync(dirname(config.databasePath), { recursive: true });

const db = createDatabase(config.databasePath);
migrateDatabase(db);

const app = buildServer({ db });
await app.listen({ port: config.port, host: "0.0.0.0" });
```

- [ ] **Step 4: Run API server tests**

Run: `npm run test --workspace @memora/api -- src/server.test.ts`

Expected: PASS with route tests.

Run: `npm run lint --workspace @memora/api`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth apps/api/src/server.ts apps/api/src/index.ts apps/api/src/server.test.ts
git commit -m "feat: expose invite activation api"
```

---

### Task 4: Add AI Prompts, Provider Interface, and JSON Validation

**Files:**
- Create: `apps/api/src/ai/provider.ts`
- Create: `apps/api/src/ai/prompts.ts`
- Create: `apps/api/src/ai/mockProvider.ts`
- Create: `apps/api/src/ai/openaiProvider.ts`
- Create: `apps/api/src/ai/prompts.test.ts`

**Interfaces:**
- Consumes: `LearningMode`, `LearningContent`, `FeynmanFeedback` validators from `@memora/shared`.
- Produces: `AiProvider`, `buildLearningPrompt(input)`, `buildFeynmanPrompt(input)`, `MockAiProvider`, `OpenAiResponsesProvider`.

- [ ] **Step 1: Write failing prompt tests**

Write `apps/api/src/ai/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildFeynmanPrompt, buildLearningPrompt } from "./prompts";

describe("learning prompts", () => {
  it("requires Chinese output even for English selected terms", () => {
    const prompt = buildLearningPrompt({
      selectedText: "demand mining",
      paragraphContext: "Product managers use demand mining to understand user needs.",
      pageTitle: "Product Discovery Notes",
      pageUrl: "https://example.com",
      mode: "mastery"
    });

    expect(prompt).toContain("所有输出必须使用简体中文");
    expect(prompt).toContain("保留原始英文词");
    expect(prompt).toContain("demand mining");
    expect(prompt).toContain("5 到 8 道选择题");
    expect(prompt).toContain("费曼学习法");
  });

  it("requires one Chinese Feynman feedback response", () => {
    const prompt = buildFeynmanPrompt({
      originalTerm: "demand mining",
      chineseDisplayName: "需求挖掘",
      userExplanation: "就是多问几个为什么。",
      expectedPoints: ["表面需求", "真实问题", "更好方案"]
    });

    expect(prompt).toContain("只返回一次反馈");
    expect(prompt).toContain("简体中文");
    expect(prompt).toContain("understanding_score");
  });
});
```

- [ ] **Step 2: Run prompt tests and verify they fail**

Run: `npm run test --workspace @memora/api -- src/ai/prompts.test.ts`

Expected: FAIL because prompt files do not exist.

- [ ] **Step 3: Implement provider interface, prompts, and mock provider**

Write `apps/api/src/ai/provider.ts`:

```ts
import type { FeynmanFeedback, LearningContent, LearningMode } from "@memora/shared";

export interface LearningGenerationInput {
  selectedText: string;
  paragraphContext: string;
  pageTitle: string;
  pageUrl: string;
  mode: LearningMode;
}

export interface FeynmanGenerationInput {
  originalTerm: string;
  chineseDisplayName: string;
  userExplanation: string;
  expectedPoints: string[];
}

export interface AiProvider {
  generateLearningContent(input: LearningGenerationInput): Promise<LearningContent>;
  generateFeynmanFeedback(input: FeynmanGenerationInput): Promise<FeynmanFeedback>;
}
```

Write `apps/api/src/ai/prompts.ts`:

```ts
import type { FeynmanGenerationInput, LearningGenerationInput } from "./provider";

export function buildLearningPrompt(input: LearningGenerationInput): string {
  return `
你是一个帮助中文用户快速学习概念的学习教练。

所有输出必须使用简体中文。即使用户选中的是英文词，也要保留原始英文词，并给出自然的中文名称或翻译。

用户选中的概念：
${input.selectedText}

页面标题：
${input.pageTitle}

所在段落：
${input.paragraphContext || "未能提取到段落，只能根据概念和标题解释。"}

页面 URL：
${input.pageUrl}

学习模式：
${input.mode}

内容要求：
1. 先判断这个词是否是值得解释的概念。
2. 说明它是什么类型：工具、机制、方法、模型、英文缩写、英文直译、行业术语或其他。
3. 用一句普通人能懂的话定义它。
4. 补充背景：它通常出现在哪里，为什么会被提到。
5. 举一个足够清晰、贴近生活、贴切概念的例子。
6. 说明例子和概念之间的映射关系。
7. 如果模式是 deep 或 mastery，生成 5 到 8 道选择题，每题 4 个选项，并给出正确答案和解释。
8. 如果模式是 mastery，加入费曼学习法提示，让用户用自己的话解释概念。

选择题必须检查理解，而不是只考记忆。题目要覆盖定义、边界、误区、使用场景和反例判断。

只返回符合约定 JSON 结构的内容，不要返回 Markdown。
`.trim();
}

export function buildFeynmanPrompt(input: FeynmanGenerationInput): string {
  return `
你是一个费曼学习法教练。请只返回一次反馈，不进行多轮追问。

所有输出必须使用简体中文。

概念原词：
${input.originalTerm}

中文名称：
${input.chineseDisplayName}

用户自己的解释：
${input.userExplanation}

这次解释最好覆盖的要点：
${input.expectedPoints.map((point) => `- ${point}`).join("\n")}

请返回 JSON，字段包括：
- understanding_score: 0 到 100 的数字
- what_is_clear: 用户已经讲清楚的地方
- missing_or_wrong: 遗漏、模糊或错误的地方
- better_explanation: 一版更清楚、更像人话的改写
- next_question: 一个帮助继续思考的问题
`.trim();
}
```

Write `apps/api/src/ai/mockProvider.ts`:

```ts
import type { FeynmanFeedback, LearningContent } from "@memora/shared";
import type { AiProvider, FeynmanGenerationInput, LearningGenerationInput } from "./provider";

export class MockAiProvider implements AiProvider {
  async generateLearningContent(input: LearningGenerationInput): Promise<LearningContent> {
    const quick = {
      concept_validity: { is_valid: true, reason: "这是一个值得解释的概念。" },
      original_term: input.selectedText,
      chinese_display_name: input.selectedText === "demand mining" ? "需求挖掘" : input.selectedText,
      concept_type: "方法",
      background: "这个词常出现在产品、学习或工作分析场景中，用来帮助人们看清表面说法背后的真实问题。",
      plain_definition: "它指的是继续追问表面说法背后的真实目标。",
      simple_example: "用户说想要一匹更快的马，但真实需求可能是更快到达目的地，所以车可能是更好的方案。",
      example_mapping: "快马是表面需求，更快到达目的地是真实需求，车是围绕真实需求找到的新方案。"
    };

    if (input.mode === "quick") return quick;

    const deep = {
      ...quick,
      key_points: ["不要停在用户原话", "继续追问真实目标", "围绕真实目标找更合适方案"],
      common_misunderstandings: ["把用户说的话当成最终答案", "只关注功能而忽略真实问题"],
      quiz: [
        {
          id: "q1",
          question: "以下哪一种最接近这个概念的意思？",
          options: [
            { id: "A" as const, text: "把用户原话整理成列表" },
            { id: "B" as const, text: "继续追问背后的真实问题" },
            { id: "C" as const, text: "尽快做出用户说的功能" },
            { id: "D" as const, text: "把所有需求都交给研发判断" }
          ],
          correct_option_id: "B" as const,
          explanation: "B 对，因为这个概念关注表面表达背后的真实目标。"
        }
      ]
    };

    if (input.mode === "deep") return deep;

    return {
      ...deep,
      feynman_prompt: "请你用自己的话解释这个概念，就像讲给一个刚入门的朋友听。",
      expected_explanation_points: ["说明它解决什么问题", "区分表面说法和真实需求", "用一个简单例子讲清楚"]
    };
  }

  async generateFeynmanFeedback(_input: FeynmanGenerationInput): Promise<FeynmanFeedback> {
    return {
      understanding_score: 82,
      what_is_clear: "你已经讲清楚了它不是照抄用户原话。",
      missing_or_wrong: "还可以补充如何通过追问找到真实目标。",
      better_explanation: "这个概念就是从用户表面说法里继续追问，找到真正要解决的问题，再寻找更合适的方案。",
      next_question: "如果用户说想要一个按钮，你会怎么判断他真正想完成什么？"
    };
  }
}
```

- [ ] **Step 4: Implement OpenAI Responses API provider**

Write `apps/api/src/ai/openaiProvider.ts`:

```ts
import type { FeynmanFeedback, LearningContent, LearningMode } from "@memora/shared";
import { validateFeynmanFeedback, validateLearningContent } from "@memora/shared";
import { buildFeynmanPrompt, buildLearningPrompt } from "./prompts";
import type { AiProvider, FeynmanGenerationInput, LearningGenerationInput } from "./provider";

interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
}

function jsonSchemaForMode(mode: LearningMode): Record<string, unknown> {
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

  const properties = mode === "quick" ? quickProperties : mode === "deep" ? deepProperties : masteryProperties;
  const required = Object.keys(properties);

  return {
    type: "object",
    additionalProperties: false,
    required,
    properties
  };
}

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: ["understanding_score", "what_is_clear", "missing_or_wrong", "better_explanation", "next_question"],
  properties: {
    understanding_score: { type: "number", minimum: 0, maximum: 100 },
    what_is_clear: { type: "string" },
    missing_or_wrong: { type: "string" },
    better_explanation: { type: "string" },
    next_question: { type: "string" }
  }
};

export class OpenAiResponsesProvider implements AiProvider {
  constructor(private options: OpenAiProviderOptions) {}

  async generateLearningContent(input: LearningGenerationInput): Promise<LearningContent> {
    const parsed = await this.requestJson(buildLearningPrompt(input), "learning_content", jsonSchemaForMode(input.mode));
    const validation = validateLearningContent(input.mode, parsed);
    if (!validation.ok) throw new Error(validation.message);
    return parsed as LearningContent;
  }

  async generateFeynmanFeedback(input: FeynmanGenerationInput): Promise<FeynmanFeedback> {
    const parsed = await this.requestJson(buildFeynmanPrompt(input), "feynman_feedback", feedbackSchema);
    const validation = validateFeynmanFeedback(parsed);
    if (!validation.ok) throw new Error(validation.message);
    return parsed as FeynmanFeedback;
  }

  private async requestJson(prompt: string, schemaName: string, schema: Record<string, unknown>): Promise<unknown> {
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

    const data = await response.json() as { output_text?: string };
    if (!data.output_text) {
      throw new Error("OpenAI response did not include output_text.");
    }
    return JSON.parse(data.output_text);
  }
}
```

- [ ] **Step 5: Run AI tests and lint**

Run: `npm run test --workspace @memora/api -- src/ai/prompts.test.ts`

Expected: PASS with prompt tests.

Run: `npm run lint --workspace @memora/api`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai apps/api/package.json package-lock.json
git commit -m "feat: add ai prompt and provider layer"
```

---

### Task 5: Implement Learning Generation Endpoint with Quota Deduction

**Files:**
- Create: `apps/api/src/learning/learningService.ts`
- Create: `apps/api/src/learning/learningService.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: `AiProvider.generateLearningContent(input)`, `validateSelectedText()`, `validateLearningContent()`, `authenticateRequest()`.
- Produces: `generateLearning(db, aiProvider, invite, request): Promise<LearnResponse>` and `POST /api/learn`.

- [ ] **Step 1: Write failing learning service tests**

Write `apps/api/src/learning/learningService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AiProvider } from "../ai/provider";
import { MockAiProvider } from "../ai/mockProvider";
import { createDatabase } from "../db/database";
import { migrateDatabase, seedInviteCode } from "../db/schema";
import { activateInvite } from "../invites/inviteService";
import { generateLearning } from "./learningService";

function setup() {
  const db = createDatabase(":memory:");
  migrateDatabase(db);
  seedInviteCode(db, "BETA-LEARN", 5);
  activateInvite(db, "BETA-LEARN");
  const invite = db.prepare("select id, code, remaining_credits from invite_codes where code = ?").get("BETA-LEARN") as { id: number; code: string; remaining_credits: number };
  return { db, invite };
}

describe("generateLearning", () => {
  it("deducts exactly one credit after a successful generation", async () => {
    const { db, invite } = setup();
    const response = await generateLearning(db, new MockAiProvider(), invite, {
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    });

    expect(response.remaining_credits).toBe(4);
    expect(response.content).toMatchObject({
      original_term: "demand mining",
      chinese_display_name: "需求挖掘"
    });
    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(4);
  });

  it("rejects no quota before returning content", async () => {
    const { db, invite } = setup();
    db.prepare("update invite_codes set remaining_credits = 0 where id = ?").run(invite.id);

    await expect(generateLearning(db, new MockAiProvider(), { ...invite, remaining_credits: 0 }, {
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    })).rejects.toMatchObject({ code: "NO_QUOTA", statusCode: 402 });
  });

  it("does not deduct credit when AI fails", async () => {
    const { db, invite } = setup();
    const failingProvider: AiProvider = {
      async generateLearningContent() {
        throw new Error("model unavailable");
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(generateLearning(db, failingProvider, invite, {
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    })).rejects.toMatchObject({ code: "AI_FAILURE" });

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(5);
  });

  it("rejects long selections without deducting credit", async () => {
    const { db, invite } = setup();
    await expect(generateLearning(db, new MockAiProvider(), invite, {
      selected_text: "需求".repeat(50),
      paragraph_context: "Long selected text.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    })).rejects.toMatchObject({ code: "SELECTION_TOO_LONG" });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test --workspace @memora/api -- src/learning/learningService.test.ts`

Expected: FAIL because `learningService.ts` does not exist.

- [ ] **Step 3: Implement learning service**

Write `apps/api/src/learning/learningService.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { LearnRequest, LearnResponse } from "@memora/shared";
import { validateLearningContent, validateSelectedText } from "@memora/shared";
import type { AiProvider } from "../ai/provider";
import type { AuthenticatedInvite } from "../auth/authMiddleware";
import type { AppDatabase } from "../db/database";
import { ApiError } from "../invites/inviteService";

export async function generateLearning(
  db: AppDatabase,
  aiProvider: AiProvider,
  invite: AuthenticatedInvite,
  request: LearnRequest
): Promise<LearnResponse> {
  const selectionValidation = validateSelectedText(request.selected_text);
  if (!selectionValidation.ok) {
    throw new ApiError(selectionValidation.code, 400, selectionValidation.message);
  }

  const quotaRow = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number } | undefined;
  if (!quotaRow || quotaRow.remaining_credits <= 0) {
    throw new ApiError("NO_QUOTA", 402, "记忆药水已用完。");
  }

  let content: Awaited<ReturnType<AiProvider["generateLearningContent"]>>;
  try {
    content = await aiProvider.generateLearningContent({
      selectedText: request.selected_text.trim(),
      paragraphContext: request.paragraph_context.trim(),
      pageTitle: request.page_title.trim(),
      pageUrl: request.page_url.trim(),
      mode: request.mode
    });
  } catch {
    throw new ApiError("AI_FAILURE", 502, "AI 生成失败，请稍后重试。");
  }

  const contentValidation = validateLearningContent(request.mode, content);
  if (!contentValidation.ok) {
    throw new ApiError(contentValidation.code, 502, contentValidation.message);
  }

  if (content.concept_validity.is_valid === false) {
    throw new ApiError("INVALID_CONCEPT", 400, content.concept_validity.reason || "请选择一个更具体的概念词。");
  }

  const sessionId = randomUUID();
  const transaction = db.transaction(() => {
    const updated = db.prepare(`
      update invite_codes
      set remaining_credits = remaining_credits - 1, last_used_at = datetime('now')
      where id = ? and remaining_credits > 0
    `).run(invite.id);

    if (updated.changes !== 1) {
      throw new ApiError("NO_QUOTA", 402, "记忆药水已用完。");
    }

    db.prepare(`
      insert into learning_sessions (
        id, invite_code_id, selected_text, paragraph_context, page_title, page_url,
        mode, ai_response_json, credit_deducted, error_code
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, 1, null)
    `).run(
      sessionId,
      invite.id,
      request.selected_text.trim(),
      request.paragraph_context.trim(),
      request.page_title.trim(),
      request.page_url.trim(),
      request.mode,
      JSON.stringify(content)
    );

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number };
    return row.remaining_credits;
  });

  const remainingCredits = transaction();
  return {
    session_id: sessionId,
    remaining_credits: remainingCredits,
    content
  };
}
```

- [ ] **Step 4: Wire `/api/learn` into server**

Modify `apps/api/src/server.ts` to accept an AI provider and add the route:

```ts
import Fastify from "fastify";
import type { AiProvider } from "./ai/provider";
import { MockAiProvider } from "./ai/mockProvider";
import type { AppDatabase } from "./db/database";
import { authenticateRequest } from "./auth/authMiddleware";
import { activateInvite, ApiError } from "./invites/inviteService";
import { generateLearning } from "./learning/learningService";

export interface ServerDependencies {
  db: AppDatabase;
  aiProvider?: AiProvider;
}

export function buildServer({ db, aiProvider = new MockAiProvider() }: ServerDependencies) {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message }
      });
    }
    return reply.status(500).send({
      error: { code: "AI_FAILURE", message: "服务暂时不可用，请稍后重试。" }
    });
  });

  app.post("/api/invite/activate", async (request) => {
    const body = request.body as { code?: string };
    return activateInvite(db, body.code ?? "");
  });

  app.get("/api/me", async (request) => {
    const invite = authenticateRequest(db, request);
    return {
      code: invite.code,
      remaining_credits: invite.remaining_credits
    };
  });

  app.post("/api/learn", async (request) => {
    const invite = authenticateRequest(db, request);
    return generateLearning(db, aiProvider, invite, request.body as Parameters<typeof generateLearning>[3]);
  });

  return app;
}
```

- [ ] **Step 5: Run learning tests and full API tests**

Run: `npm run test --workspace @memora/api -- src/learning/learningService.test.ts`

Expected: PASS with learning service tests.

Run: `npm run test --workspace @memora/api`

Expected: PASS for all API tests.

Run: `npm run lint --workspace @memora/api`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/learning apps/api/src/server.ts
git commit -m "feat: add learning generation with quota"
```

---

### Task 6: Implement Feynman Feedback Endpoint

**Files:**
- Create: `apps/api/src/feynman/feynmanService.ts`
- Create: `apps/api/src/feynman/feynmanService.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: stored `learning_sessions`, `AiProvider.generateFeynmanFeedback()`, `validateFeynmanFeedback()`.
- Produces: `submitFeynmanFeedback(db, aiProvider, invite, request): Promise<FeynmanFeedbackResponse>` and `POST /api/feynman-feedback`.

- [ ] **Step 1: Write failing Feynman feedback tests**

Write `apps/api/src/feynman/feynmanService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockAiProvider } from "../ai/mockProvider";
import { createDatabase } from "../db/database";
import { migrateDatabase, seedInviteCode } from "../db/schema";
import { activateInvite } from "../invites/inviteService";
import { generateLearning } from "../learning/learningService";
import { submitFeynmanFeedback } from "./feynmanService";

async function setupMasterySession() {
  const db = createDatabase(":memory:");
  migrateDatabase(db);
  seedInviteCode(db, "BETA-FEYNMAN", 5);
  activateInvite(db, "BETA-FEYNMAN");
  const invite = db.prepare("select id, code, remaining_credits from invite_codes where code = ?").get("BETA-FEYNMAN") as { id: number; code: string; remaining_credits: number };
  const session = await generateLearning(db, new MockAiProvider(), invite, {
    selected_text: "demand mining",
    paragraph_context: "Product managers use demand mining.",
    page_title: "Notes",
    page_url: "https://example.com",
    mode: "mastery"
  });
  return { db, invite, session };
}

describe("submitFeynmanFeedback", () => {
  it("stores one feedback response without deducting credit", async () => {
    const { db, invite, session } = await setupMasterySession();
    const before = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number };

    const response = await submitFeynmanFeedback(db, new MockAiProvider(), invite, {
      session_id: session.session_id,
      user_explanation: "需求挖掘就是不要只听用户说要什么，还要追问他真正想解决什么问题。"
    });

    expect(response.feedback.understanding_score).toBe(82);
    const after = db.prepare("select remaining_credits from invite_codes where id = ?").get(invite.id) as { remaining_credits: number };
    expect(after.remaining_credits).toBe(before.remaining_credits);
  });

  it("rejects a second feedback response for the same session", async () => {
    const { db, invite, session } = await setupMasterySession();
    await submitFeynmanFeedback(db, new MockAiProvider(), invite, {
      session_id: session.session_id,
      user_explanation: "第一次解释。"
    });

    await expect(submitFeynmanFeedback(db, new MockAiProvider(), invite, {
      session_id: session.session_id,
      user_explanation: "第二次解释。"
    })).rejects.toMatchObject({ code: "FEEDBACK_ALREADY_SUBMITTED", statusCode: 409 });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test --workspace @memora/api -- src/feynman/feynmanService.test.ts`

Expected: FAIL because `feynmanService.ts` does not exist.

- [ ] **Step 3: Implement Feynman feedback service**

Write `apps/api/src/feynman/feynmanService.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { FeynmanFeedbackRequest, FeynmanFeedbackResponse, MasteryContent } from "@memora/shared";
import { validateFeynmanFeedback } from "@memora/shared";
import type { AiProvider } from "../ai/provider";
import type { AuthenticatedInvite } from "../auth/authMiddleware";
import type { AppDatabase } from "../db/database";
import { ApiError } from "../invites/inviteService";

interface SessionRow {
  id: string;
  invite_code_id: number;
  mode: string;
  ai_response_json: string;
}

export async function submitFeynmanFeedback(
  db: AppDatabase,
  aiProvider: AiProvider,
  invite: AuthenticatedInvite,
  request: FeynmanFeedbackRequest
): Promise<FeynmanFeedbackResponse> {
  const session = db.prepare(`
    select id, invite_code_id, mode, ai_response_json
    from learning_sessions
    where id = ? and invite_code_id = ?
  `).get(request.session_id, invite.id) as SessionRow | undefined;

  if (!session) {
    throw new ApiError("SESSION_NOT_FOUND", 404, "没有找到这次学习记录。");
  }
  if (session.mode !== "mastery") {
    throw new ApiError("SESSION_NOT_FOUND", 400, "只有深度理解模式支持费曼反馈。");
  }

  const existing = db.prepare("select id from feynman_feedbacks where learning_session_id = ?").get(session.id);
  if (existing) {
    throw new ApiError("FEEDBACK_ALREADY_SUBMITTED", 409, "这次学习已经提交过费曼反馈。");
  }

  const content = JSON.parse(session.ai_response_json) as MasteryContent;
  let feedback: Awaited<ReturnType<AiProvider["generateFeynmanFeedback"]>>;
  try {
    feedback = await aiProvider.generateFeynmanFeedback({
      originalTerm: content.original_term,
      chineseDisplayName: content.chinese_display_name,
      userExplanation: request.user_explanation.trim(),
      expectedPoints: content.expected_explanation_points
    });
  } catch {
    throw new ApiError("AI_FAILURE", 502, "AI 反馈生成失败，请稍后重试。");
  }

  const validation = validateFeynmanFeedback(feedback);
  if (!validation.ok) {
    throw new ApiError(validation.code, 502, validation.message);
  }

  db.prepare(`
    insert into feynman_feedbacks (id, learning_session_id, user_explanation, ai_feedback_json)
    values (?, ?, ?, ?)
  `).run(randomUUID(), session.id, request.user_explanation.trim(), JSON.stringify(feedback));

  return { feedback };
}
```

- [ ] **Step 4: Wire `/api/feynman-feedback` into server**

Modify `apps/api/src/server.ts` to import `submitFeynmanFeedback` and add:

```ts
  app.post("/api/feynman-feedback", async (request) => {
    const invite = authenticateRequest(db, request);
    return submitFeynmanFeedback(db, aiProvider, invite, request.body as Parameters<typeof submitFeynmanFeedback>[3]);
  });
```

- [ ] **Step 5: Run Feynman tests and full API tests**

Run: `npm run test --workspace @memora/api -- src/feynman/feynmanService.test.ts`

Expected: PASS with Feynman service tests.

Run: `npm run test --workspace @memora/api`

Expected: PASS for all API tests.

Run: `npm run lint --workspace @memora/api`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/feynman apps/api/src/server.ts
git commit -m "feat: add feynman feedback endpoint"
```

---

### Task 7: Add Extension Scaffold, Context Menu, and Selection Extraction

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/vite.config.ts`
- Create: `apps/extension/index.html`
- Create: `apps/extension/manifest.json`
- Create: `apps/extension/src/background.ts`
- Create: `apps/extension/src/contentScript.ts`
- Create: `apps/extension/src/contentScript.test.ts`

**Interfaces:**
- Produces: Chrome context menu item `learn-concept`, side panel path `index.html`, `getSelectionContext(): SelectionContext`.
- Consumes: no extension internals from earlier tasks.

- [ ] **Step 1: Create extension package metadata**

Write `apps/extension/package.json`:

```json
{
  "name": "@memora/extension",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@memora/shared": "0.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vite": "^5.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Write `apps/extension/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["chrome", "vitest/globals", "@testing-library/jest-dom"],
    "composite": true
  },
  "references": [
    { "path": "../../packages/shared" }
  ],
  "include": ["src", "vite.config.ts"]
}
```

Write `apps/extension/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: "index.html",
        background: "src/background.ts",
        contentScript: "src/contentScript.ts"
      },
      output: {
        entryFileNames: "[name].js"
      }
    }
  },
  test: {
    environment: "jsdom"
  }
});
```

- [ ] **Step 2: Create manifest, HTML shell, background, and content script tests**

Write `apps/extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Memora",
  "version": "0.1.0",
  "description": "Memora 记忆药水：right-click a selected concept and learn it in Chinese.",
  "permissions": ["contextMenus", "storage", "activeTab", "scripting", "sidePanel"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "index.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["contentScript.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Memora"
  }
}
```

Write `apps/extension/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Memora</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/panel/main.tsx"></script>
  </body>
</html>
```

Write `apps/extension/src/contentScript.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findNearestParagraphText, normalizeSelectedText } from "./contentScript";

describe("selection extraction helpers", () => {
  it("normalizes selected text", () => {
    expect(normalizeSelectedText("  demand   mining  ")).toBe("demand mining");
  });

  it("finds the nearest paragraph from a selected node", () => {
    document.body.innerHTML = `
      <article>
        <p id="target">Product managers use <strong>demand mining</strong> to understand users.</p>
      </article>
    `;
    const strong = document.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(findNearestParagraphText(strong as Element)).toBe("Product managers use demand mining to understand users.");
  });
});
```

- [ ] **Step 3: Run extension tests and verify they fail**

Run: `npm run test --workspace @memora/extension -- src/contentScript.test.ts`

Expected: FAIL because `contentScript.ts` does not exist.

- [ ] **Step 4: Implement background and content script**

Write `apps/extension/src/background.ts`:

```ts
const MENU_ID = "learn-concept";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "学习这个概念",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  await chrome.sidePanel.open({ tabId: tab.id });
  await chrome.tabs.sendMessage(tab.id, { type: "AI_LEARNING_CAPTURE_SELECTION" });
});
```

Write `apps/extension/src/contentScript.ts`:

```ts
export interface SelectionContext {
  selectedText: string;
  paragraphContext: string;
  pageTitle: string;
  pageUrl: string;
}

export function normalizeSelectedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function findNearestParagraphText(node: Node | null): string {
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element) {
      const paragraph = current.closest("p, article, section, main, li, blockquote");
      if (paragraph?.textContent) {
        return normalizeSelectedText(paragraph.textContent).slice(0, 3000);
      }
    }
    current = current.parentNode;
  }
  return "";
}

export function getSelectionContext(): SelectionContext {
  const selection = window.getSelection();
  const selectedText = normalizeSelectedText(selection?.toString() ?? "");
  const anchorNode = selection?.anchorNode ?? null;
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;

  return {
    selectedText,
    paragraphContext: findNearestParagraphText(anchorElement),
    pageTitle: document.title,
    pageUrl: window.location.href
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "AI_LEARNING_CAPTURE_SELECTION") {
    chrome.storage.local.set({ pendingSelection: getSelectionContext() }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
```

- [ ] **Step 5: Run extension scaffold verification**

Run: `npm run test --workspace @memora/extension -- src/contentScript.test.ts`

Expected: PASS with extraction helper tests.

Run: `npm run build --workspace @memora/extension`

Expected: `apps/extension/dist` contains `background.js`, `contentScript.js`, `index.html`, and bundled panel assets.

Run: `npm run lint --workspace @memora/extension`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/extension package-lock.json
git commit -m "feat: add extension context menu and selection capture"
```

---

### Task 8: Add Extension API Client and Panel State

**Files:**
- Create: `apps/extension/src/lib/apiClient.ts`
- Create: `apps/extension/src/lib/sessionStore.ts`
- Create: `apps/extension/src/lib/apiClient.test.ts`
- Create: `apps/extension/src/lib/sessionStore.test.ts`

**Interfaces:**
- Consumes: shared API request/response types.
- Produces: `ApiClient`, `createApiClient(baseUrl, tokenStore)`, `loadToken()`, `saveToken()`, `loadPendingSelection()`, `saveLearningSession()`.

- [ ] **Step 1: Write failing API client and storage tests**

Write `apps/extension/src/lib/apiClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./apiClient";

describe("apiClient", () => {
  it("activates invite code and stores token", async () => {
    const saveToken = vi.fn();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      token: "token-123",
      remaining_credits: 5
    }), { status: 200 }));

    const client = createApiClient("https://api.example.com", {
      getToken: async () => null,
      saveToken,
      fetchImpl: fetchMock
    });

    const response = await client.activateInvite("BETA-001");

    expect(response.remaining_credits).toBe(5);
    expect(saveToken).toHaveBeenCalledWith("token-123");
  });

  it("sends bearer token to learn endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      session_id: "session-1",
      remaining_credits: 4,
      content: {
        concept_validity: { is_valid: true, reason: "这是概念。" },
        original_term: "demand mining",
        chinese_display_name: "需求挖掘",
        concept_type: "方法",
        background: "背景",
        plain_definition: "定义",
        simple_example: "例子",
        example_mapping: "映射"
      }
    }), { status: 200 }));

    const client = createApiClient("https://api.example.com", {
      getToken: async () => "token-123",
      saveToken: async () => undefined,
      fetchImpl: fetchMock
    });

    await client.learn({
      selected_text: "demand mining",
      paragraph_context: "paragraph",
      page_title: "title",
      page_url: "https://example.com",
      mode: "quick"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/api/learn", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer token-123" })
    }));
  });
});
```

Write `apps/extension/src/lib/sessionStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPendingSelection, loadToken, saveToken } from "./sessionStore";

const storage: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.map((key) => [key, storage[key]]));
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        })
      }
    }
  });
});

describe("sessionStore", () => {
  it("saves and loads token", async () => {
    await saveToken("abc");
    await expect(loadToken()).resolves.toBe("abc");
  });

  it("loads pending selection", async () => {
    storage.pendingSelection = {
      selectedText: "demand mining",
      paragraphContext: "paragraph",
      pageTitle: "title",
      pageUrl: "https://example.com"
    };

    await expect(loadPendingSelection()).resolves.toMatchObject({ selectedText: "demand mining" });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test --workspace @memora/extension -- src/lib/apiClient.test.ts src/lib/sessionStore.test.ts`

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement API client and session store**

Write `apps/extension/src/lib/sessionStore.ts`:

```ts
import type { LearningContent, LearningMode } from "@memora/shared";
import type { SelectionContext } from "../contentScript";

const TOKEN_KEY = "accessToken";

export interface StoredLearningSession {
  sessionId: string;
  remainingCredits: number;
  mode: LearningMode;
  content: LearningContent;
}

export async function loadToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return typeof result[TOKEN_KEY] === "string" ? result[TOKEN_KEY] : null;
}

export async function saveToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function loadPendingSelection(): Promise<SelectionContext | null> {
  const result = await chrome.storage.local.get("pendingSelection");
  return result.pendingSelection as SelectionContext | null;
}

export async function saveLearningSession(session: StoredLearningSession): Promise<void> {
  await chrome.storage.local.set({ currentLearningSession: session });
}
```

Write `apps/extension/src/lib/apiClient.ts`:

```ts
import type {
  ActivateInviteResponse,
  FeynmanFeedbackRequest,
  FeynmanFeedbackResponse,
  LearnRequest,
  LearnResponse
} from "@memora/shared";

interface TokenStore {
  getToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  fetchImpl?: typeof fetch;
}

export function createApiClient(baseUrl: string, tokenStore: TokenStore) {
  const fetchImpl = tokenStore.fetchImpl ?? fetch;

  async function request<T>(path: string, body: unknown, auth: boolean): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      const token = await tokenStore.getToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message ?? "请求失败，请稍后重试。";
      throw new Error(message);
    }
    return payload as T;
  }

  return {
    async activateInvite(code: string): Promise<ActivateInviteResponse> {
      const response = await request<ActivateInviteResponse>("/api/invite/activate", { code }, false);
      await tokenStore.saveToken(response.token);
      return response;
    },

    learn(requestBody: LearnRequest): Promise<LearnResponse> {
      return request<LearnResponse>("/api/learn", requestBody, true);
    },

    submitFeynmanFeedback(requestBody: FeynmanFeedbackRequest): Promise<FeynmanFeedbackResponse> {
      return request<FeynmanFeedbackResponse>("/api/feynman-feedback", requestBody, true);
    }
  };
}
```

- [ ] **Step 4: Run extension library tests**

Run: `npm run test --workspace @memora/extension -- src/lib/apiClient.test.ts src/lib/sessionStore.test.ts`

Expected: PASS with API client and storage tests.

Run: `npm run lint --workspace @memora/extension`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib
git commit -m "feat: add extension api client and storage"
```

---

### Task 9: Build Side Panel UI, Quiz Interaction, and Visual System

**Files:**
- Create: `apps/extension/src/panel/main.tsx`
- Create: `apps/extension/src/panel/App.tsx`
- Create: `apps/extension/src/panel/App.test.tsx`
- Create: `apps/extension/src/panel/components/InviteGate.tsx`
- Create: `apps/extension/src/panel/components/ModeTabs.tsx`
- Create: `apps/extension/src/panel/components/LearningContentView.tsx`
- Create: `apps/extension/src/panel/components/QuizView.tsx`
- Create: `apps/extension/src/panel/components/FeynmanBox.tsx`
- Create: `apps/extension/src/panel/components/PotionBottleIcon.tsx`
- Create: `apps/extension/src/panel/components/ErrorNotice.tsx`
- Create: `apps/extension/src/panel/styles.css`

**Interfaces:**
- Consumes: `createApiClient`, `loadPendingSelection`, `saveLearningSession`, shared content types.
- Produces: complete side panel UI for invite activation, learning generation, mode switching, quiz feedback, and one Feynman feedback submission.

- [ ] **Step 1: Write failing panel tests**

Write `apps/extension/src/panel/App.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const selection = {
  selectedText: "demand mining",
  paragraphContext: "Product managers use demand mining.",
  pageTitle: "Notes",
  pageUrl: "https://example.com"
};

describe("App", () => {
  it("activates invite and generates Chinese quick content", async () => {
    const client = {
      activateInvite: vi.fn(async () => ({ token: "token-1", remaining_credits: 5 })),
      learn: vi.fn(async () => ({
        session_id: "session-1",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "demand mining",
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "这个词常出现在产品场景。",
          plain_definition: "需求挖掘就是追问真实问题。",
          simple_example: "用户说想要快马，真实需求是更快到达目的地。",
          example_mapping: "快马是表面需求，目的地是深层需求。"
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken={null} />);

    fireEvent.change(screen.getByLabelText("邀请码"), { target: { value: "BETA-001" } });
    fireEvent.click(screen.getByRole("button", { name: "开始学习" }));

    await waitFor(() => expect(screen.getByText("需求挖掘")).toBeInTheDocument());
    expect(screen.getByText("还剩 4 瓶记忆药水")).toBeInTheDocument();
    expect(screen.getByText("用户说想要快马，真实需求是更快到达目的地。")).toBeInTheDocument();
  });

  it("shows quiz feedback immediately", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-2",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "demand mining",
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "背景",
          plain_definition: "定义",
          simple_example: "例子",
          example_mapping: "映射",
          key_points: ["要点一", "要点二", "要点三"],
          common_misunderstandings: ["误区一", "误区二"],
          quiz: [{
            id: "q1",
            question: "哪项正确？",
            options: [
              { id: "A", text: "整理原话" },
              { id: "B", text: "追问真实问题" },
              { id: "C", text: "直接开发" },
              { id: "D", text: "跳过研究" }
            ],
            correct_option_id: "B",
            explanation: "B 对，因为它关注真实问题。"
          }]
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    await waitFor(() => expect(screen.getByText("哪项正确？")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "整理原话" }));

    expect(screen.getByText("B 对，因为它关注真实问题。")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run panel tests and verify they fail**

Run: `npm run test --workspace @memora/extension -- src/panel/App.test.tsx`

Expected: FAIL because panel components do not exist.

- [ ] **Step 3: Implement panel entry and core app**

Write `apps/extension/src/panel/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "../lib/apiClient";
import { loadPendingSelection, loadToken, saveToken } from "../lib/sessionStore";
import { App } from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
const initialSelection = await loadPendingSelection();
const initialToken = await loadToken();
const apiClient = createApiClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787", {
  getToken: loadToken,
  saveToken
});

root.render(
  <React.StrictMode>
    <App apiClient={apiClient} initialSelection={initialSelection} initialToken={initialToken} />
  </React.StrictMode>
);
```

Write `apps/extension/src/panel/App.tsx` with state for invite, mode, loading, content, quiz selections, and feedback:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { FeynmanFeedback, LearningContent, LearningMode } from "@memora/shared";
import type { SelectionContext } from "../contentScript";
import { saveLearningSession } from "../lib/sessionStore";
import { ErrorNotice } from "./components/ErrorNotice";
import { FeynmanBox } from "./components/FeynmanBox";
import { InviteGate } from "./components/InviteGate";
import { LearningContentView } from "./components/LearningContentView";
import { ModeTabs } from "./components/ModeTabs";
import { PotionBottleIcon } from "./components/PotionBottleIcon";

interface ApiClientLike {
  activateInvite(code: string): Promise<{ token: string; remaining_credits: number }>;
  learn(request: {
    selected_text: string;
    paragraph_context: string;
    page_title: string;
    page_url: string;
    mode: LearningMode;
  }): Promise<{ session_id: string; remaining_credits: number; content: LearningContent }>;
  submitFeynmanFeedback(request: { session_id: string; user_explanation: string }): Promise<{ feedback: FeynmanFeedback }>;
}

interface AppProps {
  apiClient: ApiClientLike;
  initialSelection: SelectionContext | null;
  initialToken: string | null;
}

export function App({ apiClient, initialSelection, initialToken }: AppProps) {
  const [tokenReady, setTokenReady] = useState(Boolean(initialToken));
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [mode, setMode] = useState<LearningMode>("quick");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [content, setContent] = useState<LearningContent | null>(null);
  const [feedback, setFeedback] = useState<FeynmanFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(() => Boolean(initialSelection?.selectedText) && remainingCredits !== 0, [initialSelection, remainingCredits]);

  async function activateInvite(code: string) {
    setError(null);
    const response = await apiClient.activateInvite(code);
    setTokenReady(true);
    setRemainingCredits(response.remaining_credits);
  }

  async function generate(nextMode = mode) {
    if (!initialSelection) {
      setError("请先在网页中选中一个概念。");
      return;
    }
    if (remainingCredits === 0) {
      setError("记忆药水已用完。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.learn({
        selected_text: initialSelection.selectedText,
        paragraph_context: initialSelection.paragraphContext,
        page_title: initialSelection.pageTitle,
        page_url: initialSelection.pageUrl,
        mode: nextMode
      });
      setSessionId(response.session_id);
      setRemainingCredits(response.remaining_credits);
      setContent(response.content);
      setFeedback(null);
      await saveLearningSession({
        sessionId: response.session_id,
        remainingCredits: response.remaining_credits,
        mode: nextMode,
        content: response.content
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(nextMode: LearningMode) {
    setMode(nextMode);
    await generate(nextMode);
  }

  async function submitExplanation(userExplanation: string) {
    if (!sessionId) return;
    const response = await apiClient.submitFeynmanFeedback({ session_id: sessionId, user_explanation: userExplanation });
    setFeedback(response.feedback);
  }

  useEffect(() => {
    if (tokenReady && initialSelection?.selectedText && content === null) {
      void generate("quick");
    }
  }, [tokenReady]);

  if (!tokenReady) {
    return <InviteGate onSubmit={activateInvite} />;
  }

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Memora 记忆药水</p>
          <h1>{content?.chinese_display_name || initialSelection?.selectedText || "选择一个概念"}</h1>
        </div>
        <span className="quota-pill"><PotionBottleIcon />还剩 {remainingCredits ?? "-"} 瓶记忆药水</span>
      </header>
      <ModeTabs value={mode} onChange={changeMode} disabled={loading || !canGenerate} />
      {error && <ErrorNotice message={error} />}
      {loading && <div className="skeleton">正在生成中文学习内容...</div>}
      {content && <LearningContentView content={content} mode={mode} />}
      {content && mode === "mastery" && "feynman_prompt" in content && (
        <FeynmanBox prompt={content.feynman_prompt} feedback={feedback} onSubmit={submitExplanation} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: Implement components and styles**

Write each component with narrow responsibility:

```tsx
// apps/extension/src/panel/components/InviteGate.tsx
import { FormEvent, useState } from "react";

export function InviteGate({ onSubmit }: { onSubmit(code: string): Promise<void> }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="invite-shell">
      <form className="invite-card" onSubmit={submit}>
        <h1>输入邀请码</h1>
        <label htmlFor="invite-code">邀请码</label>
        <input id="invite-code" value={code} onChange={(event) => setCode(event.target.value)} />
        <button type="submit" disabled={loading || code.trim().length === 0}>{loading ? "验证中..." : "开始学习"}</button>
      </form>
    </main>
  );
}
```

```tsx
// apps/extension/src/panel/components/ModeTabs.tsx
import type { LearningMode } from "@memora/shared";

const MODES: Array<{ value: LearningMode; label: string }> = [
  { value: "quick", label: "大概了解" },
  { value: "deep", label: "深入理解" },
  { value: "mastery", label: "深度理解" }
];

export function ModeTabs({ value, disabled, onChange }: { value: LearningMode; disabled: boolean; onChange(mode: LearningMode): void }) {
  return (
    <div className="mode-tabs">
      {MODES.map((mode) => (
        <button key={mode.value} type="button" disabled={disabled} className={value === mode.value ? "active" : ""} onClick={() => onChange(mode.value)}>
          {mode.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// apps/extension/src/panel/components/LearningContentView.tsx
import type { LearningContent, LearningMode } from "@memora/shared";
import { QuizView } from "./QuizView";

export function LearningContentView({ content, mode }: { content: LearningContent; mode: LearningMode }) {
  return (
    <section className="content-stack">
      <div className="section-block"><span>它是什么</span><p>{content.concept_type}</p></div>
      <div className="section-block"><span>背景</span><p>{content.background}</p></div>
      <div className="section-block highlight"><span>一句话定义</span><p>{content.plain_definition}</p></div>
      <div className="section-block"><span>生活化例子</span><p>{content.simple_example}</p><p className="muted">{content.example_mapping}</p></div>
      {mode !== "quick" && "quiz" in content && <QuizView questions={content.quiz} />}
    </section>
  );
}
```

```tsx
// apps/extension/src/panel/components/QuizView.tsx
import { useState } from "react";
import type { QuizQuestion } from "@memora/shared";

export function QuizView({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <section className="quiz-stack">
      <h2>理解小测</h2>
      {questions.map((question) => {
        const selected = answers[question.id];
        return (
          <div className="quiz-card" key={question.id}>
            <p>{question.question}</p>
            {question.options.map((option) => (
              <button key={option.id} type="button" className={selected === option.id ? "selected" : ""} onClick={() => setAnswers({ ...answers, [question.id]: option.id })}>
                {option.text}
              </button>
            ))}
            {selected && <p className={selected === question.correct_option_id ? "answer-correct" : "answer-wrong"}>{question.explanation}</p>}
          </div>
        );
      })}
    </section>
  );
}
```

```tsx
// apps/extension/src/panel/components/FeynmanBox.tsx
import { FormEvent, useState } from "react";
import type { FeynmanFeedback } from "@memora/shared";

export function FeynmanBox({ prompt, feedback, onSubmit }: { prompt: string; feedback: FeynmanFeedback | null; onSubmit(value: string): Promise<void> }) {
  const [value, setValue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(value);
  }
  return (
    <section className="section-block">
      <span>费曼练习</span>
      <p>{prompt}</p>
      {!feedback && (
        <form onSubmit={submit}>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} />
          <button type="submit" disabled={value.trim().length === 0}>提交解释</button>
        </form>
      )}
      {feedback && (
        <div className="feedback-box">
          <strong>{feedback.understanding_score} 分</strong>
          <p>{feedback.what_is_clear}</p>
          <p>{feedback.missing_or_wrong}</p>
          <p>{feedback.better_explanation}</p>
        </div>
      )}
    </section>
  );
}
```

```tsx
// apps/extension/src/panel/components/PotionBottleIcon.tsx
export function PotionBottleIcon() {
  return (
    <span className="potion-icon" aria-hidden="true">
      <span className="potion-neck" />
      <span className="potion-body" />
    </span>
  );
}
```

```tsx
// apps/extension/src/panel/components/ErrorNotice.tsx
export function ErrorNotice({ message }: { message: string }) {
  return <div className="error-notice">{message}</div>;
}
```

Write `apps/extension/src/panel/styles.css` with the approved visual tokens:

```css
:root {
  color: #1f1f1d;
  background: #f7f7f4;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: #f7f7f4; }
button, input, textarea { font: inherit; }

.panel-shell, .invite-shell {
  min-height: 100vh;
  padding: 20px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e7e7e2;
}

.eyebrow {
  margin: 0 0 4px;
  color: #8a8a84;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: 0;
}

.quota-pill, .mode-tabs button {
  border: 1px solid #e7e7e2;
  border-radius: 999px;
  background: #fff;
}

.quota-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  white-space: nowrap;
}

.potion-icon {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 22px;
  flex: 0 0 auto;
}

.potion-neck,
.potion-body {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid rgba(39, 89, 132, 0.34);
  background:
    radial-gradient(circle, rgba(39, 89, 132, 0.82) 1px, transparent 1.2px) 0 0 / 4px 4px,
    linear-gradient(145deg, rgba(126, 205, 230, 0.62), rgba(217, 255, 99, 0.28));
  box-shadow: inset 0 0 8px rgba(255, 255, 255, 0.65);
}

.potion-neck {
  top: 1px;
  width: 8px;
  height: 7px;
  border-radius: 4px 4px 2px 2px;
}

.potion-body {
  top: 7px;
  width: 15px;
  height: 14px;
  border-radius: 7px 7px 5px 5px;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0;
}

.mode-tabs button {
  min-height: 40px;
  color: #1f1f1d;
}

.mode-tabs button.active {
  background: #d9ff63;
  border-color: #d9ff63;
}

.content-stack, .quiz-stack {
  display: grid;
  gap: 12px;
}

.section-block, .quiz-card, .invite-card {
  border: 1px solid #e7e7e2;
  border-radius: 16px;
  background: #fff;
  padding: 16px;
}

.section-block span {
  display: block;
  margin-bottom: 8px;
  color: #8a8a84;
  font-size: 12px;
  font-weight: 700;
}

.section-block p {
  margin: 0 0 8px;
  line-height: 1.6;
}

.section-block.highlight {
  background: #fbfff0;
  border-color: #d9ff63;
}

.muted { color: #8a8a84; }

.quiz-card button {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid #e7e7e2;
  border-radius: 14px;
  background: #fff;
  text-align: left;
}

.quiz-card button.selected {
  border-color: #d9ff63;
  background: #fbfff0;
}

.answer-correct { color: #2c6a24; }
.answer-wrong { color: #b84545; }

.error-notice {
  margin: 12px 0;
  padding: 12px;
  border-radius: 14px;
  background: #fff0f0;
  color: #b84545;
}

.skeleton {
  border-radius: 16px;
  padding: 16px;
  background: #fff;
  color: #8a8a84;
}

textarea, input {
  width: 100%;
  border: 1px solid #e7e7e2;
  border-radius: 14px;
  padding: 12px;
}

textarea { min-height: 120px; resize: vertical; }

form button {
  margin-top: 12px;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: #d9ff63;
  padding: 0 18px;
  font-weight: 700;
}
```

- [ ] **Step 5: Run panel tests, build, and visual lint**

Run: `npm run test --workspace @memora/extension -- src/panel/App.test.tsx`

Expected: PASS with invite and quiz interaction tests.

Run: `npm run build --workspace @memora/extension`

Expected: build exits 0 and emits `apps/extension/dist`.

Run: `npm run lint --workspace @memora/extension`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/src/panel apps/extension/index.html
git commit -m "feat: add learning side panel ui"
```

---

### Task 10: Add End-to-End Smoke Test and Development Docs

**Files:**
- Create: `e2e/fixtures/sample-article.html`
- Create: `e2e/extension-smoke.spec.ts`
- Modify: `package.json`
- Create: `docs/development.md`

**Interfaces:**
- Consumes: built backend and built extension.
- Produces: reproducible local smoke path and human-readable setup doc.

- [ ] **Step 1: Add Playwright dependency and scripts**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -b --pretty false",
    "test:e2e": "playwright test e2e/extension-smoke.spec.ts"
  }
}
```

Add dev dependency:

```bash
npm install -D @playwright/test
```

- [ ] **Step 2: Create sample article fixture**

Write `e2e/fixtures/sample-article.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>需求研究笔记</title>
  </head>
  <body>
    <main>
      <article>
        <h1>Product Discovery Notes</h1>
        <p>Product managers use <strong>demand mining</strong> to understand what users really need instead of only recording what users say they want.</p>
      </article>
    </main>
  </body>
</html>
```

- [ ] **Step 3: Create extension smoke test**

Write `e2e/extension-smoke.spec.ts`:

```ts
import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

test("extension opens side panel path and renders invite gate", async () => {
  const extensionPath = path.resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await context.newPage();
  await page.goto(`file://${path.resolve("e2e/fixtures/sample-article.html")}`);

  const [background] = context.serviceWorkers();
  expect(background).toBeTruthy();

  await context.close();
});
```

This smoke test confirms the built extension can load in Chromium. Full side panel context-menu automation can be added after the basic build is stable because Chrome extension side panels are harder to drive than normal pages.

- [ ] **Step 4: Write development docs**

Write `docs/development.md`:

```md
# Development

## Install

Run:

```bash
npm install
```

## Run Tests

```bash
npm test
npm run lint
```

## Seed Local Invite Code

Start the API with mock AI:

```bash
AI_PROVIDER=mock DATABASE_PATH=data/ai-learning.sqlite npm run dev --workspace @memora/api
```

Use a SQLite client to insert a private beta code:

```sql
insert into invite_codes (code, total_credits, remaining_credits, is_active)
values ('BETA-001', 5, 5, 1);
```

## Run Extension Locally

Build:

```bash
npm run build --workspace @memora/extension
```

Open Chrome Extensions, enable developer mode, choose "Load unpacked", and select:

```text
apps/extension/dist
```

## Production AI

The backend owns model credentials. Set these environment variables on the backend host:

```bash
AI_PROVIDER=openai
DATABASE_PATH=data/ai-learning.sqlite
```

Add `OPENAI_API_KEY` and `OPENAI_MODEL` as secret values in the hosting provider's environment settings. `OPENAI_MODEL` must be a Responses API model that supports structured JSON Schema output.

The extension never stores AI provider credentials.
```

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected: PASS for shared, API, and extension unit tests.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: API, shared package, and extension builds exit 0.

Run: `npm run test:e2e`

Expected: Playwright launches Chromium with the built extension and exits 0.

- [ ] **Step 6: Commit**

```bash
git add e2e docs/development.md package.json package-lock.json
git commit -m "test: add extension smoke test and dev docs"
```

---

## Self-Review Checklist

- Spec coverage: invite-code access, 5-memory-potion quota, right-click trigger, selected term plus paragraph/title/URL context, three modes, Chinese output for English terms, choice questions, one Feynman feedback response, soft-green visual direction, backend-owned AI credentials, and private-beta launch path are each mapped to tasks above.
- Scope control: payments, full account system, admin dashboard, analytics, mobile, multi-browser support, and multi-round Feynman roleplay are excluded.
- Type consistency: `LearningMode` is consistently `quick | deep | mastery`; API fields use snake_case over the wire; extension local state maps captured `selectedText` to API `selected_text`.
- Testing coverage: shared validators, backend quota/auth/AI flow, extension extraction/client/panel behavior, and one extension smoke test are included.
- Commit cadence: each task ends with an independently reviewable commit.
