# Memora Browser Extension Design

Date: 2026-06-29

## Product Positioning

Memora is a lightweight Chrome extension that helps readers understand unfamiliar concepts while reading web articles. Its Chinese product name is "Memora 记忆药水". It is not a general AI assistant, translation tool, or encyclopedia plugin. Its intended position is an "instant concept coach" for the AI era: when a user gets stuck on a term, the extension explains it in context, checks understanding with questions, and, in the deepest mode, asks the user to explain the concept back using a Feynman-style exercise.

The core product metaphor is a memory potion. One successful learning generation consumes one bottle. The user-facing quota copy should say "还剩 N 瓶记忆药水" instead of "还剩 N 次". The backend can still use `credits` internally because credits are the accounting primitive, but the interface should make the quota feel like useful study fuel rather than a cold usage limit.

The core validation metric for the first private beta is whether invited users consume their 5 free memory potions. If many users finish the quota and ask for more, the learning scenario is likely real. If users do not consume the quota, the team should inspect whether the trigger is too hidden, the explanations are too generic, or the need is weaker than expected.

## MVP Scope

The MVP will use a Chrome extension, a minimal shared backend, and a database. It will support invite-code access, 5 free memory potions per invite code, right-click concept learning, three learning modes, multiple-choice understanding checks, and one Feynman feedback round.

The MVP will not include payments, a full user account system, email login, Google login, admin dashboards, multi-browser support, mobile support, or long-term learning analytics.

## User Flow

1. The user installs the Chrome extension.
2. The first time the side panel opens, the user enters an invite code.
3. The backend validates the invite code and returns an access token plus the remaining memory-potion quota.
4. The user selects a concept term on a web page.
5. The user right-clicks and chooses "Learn this concept".
6. The extension opens the right-side learning panel.
7. The extension captures the selected term, the nearest current paragraph, and the page title.
8. The side panel defaults to "Quick Understanding" mode.
9. The backend generates structured learning content.
10. A successful generation consumes 1 memory potion.
11. The user can switch to "Deep Understanding" or "Mastery" mode and generate richer content.
12. In "Deep Understanding", the user answers 5-8 multiple-choice questions and receives immediate explanations.
13. In "Mastery", the user can also write an explanation in their own words.
14. The backend returns Feynman-style feedback for the user's explanation without deducting extra quota.
15. If the memory-potion quota reaches 0, the user can view existing content in the current panel but cannot generate new learning content.

## Access and Quota Rules

Invite code is the MVP identity model. Each invite code acts as one lightweight account.

- Each active invite code has 5 initial learning credits, shown to the user as 5 bottles of memory potion.
- A credit is deducted only after a learning generation succeeds; the UI describes this as consuming 1 memory potion.
- Quick Understanding, Deep Understanding, and Mastery each cost 1 credit per successful generation.
- Feynman feedback does not deduct extra credits, but it must be attached to a successful Mastery learning session.
- Network failures, AI failures, invalid concepts, malformed AI responses, and backend errors do not deduct credits.
- If the backend detects no remaining credits, it rejects generation before calling the AI model.
- The frontend always displays the remaining quota after invite validation and after each generation with the copy `还剩 N 瓶记忆药水`.

## Trigger Model

The extension will use the browser right-click menu, not a floating selection button.

Reasoning:

- A floating selection button is unstable across websites.
- It can feel intrusive while reading.
- A right-click menu is predictable, quiet, and aligned with the product's study-tool personality.

The menu item appears when the user has selected text. The MVP menu label should be clear and calm, such as "Learn this concept".

## Context Extraction

The extension sends only the minimum useful context:

- Selected concept term.
- Nearest paragraph or block of surrounding text.
- Page title.
- Page URL for record keeping and future debugging.

The MVP does not send the full article. If paragraph extraction fails, the extension still sends the selected term and page title.

The selected term should be validated before generation. If it is empty, too long, or not concept-like, the backend returns a friendly error asking the user to select a more specific concept.

## Language Rules

The MVP output language is Simplified Chinese.

- If the selected concept is Chinese, the extension explains it in Chinese.
- If the selected concept is English or mixed Chinese-English, the extension preserves the original selected term but explains, asks questions, and gives feedback in Chinese.
- Quiz questions, answer options, answer explanations, Feynman prompts, and Feynman feedback are all in Chinese.
- For English terms, the response should include a natural Chinese name or translation when helpful, but it should not hide the original term.
- The UI can display the concept as `original term / Chinese name` when a Chinese name exists.
- The backend prompt must explicitly request Simplified Chinese output for every learning mode and feedback response.

## Learning Modes

### Quick Understanding

This is the default mode. It gives the fastest useful answer.

Required output:

- Original term: the exact selected concept text.
- Chinese display name: a natural Chinese name or translation when the selected term is English or mixed-language.
- Concept type: what kind of thing the term is, such as a method, tool, mechanism, model, role term, English abbreviation, translated phrase, or industry phrase.
- Background: where this term usually appears and why people mention it.
- Plain definition: one sentence in everyday language.
- Simple example: a clear and life-like example.
- Example mapping: how the example maps back to the concept.

### Deep Understanding

This mode includes everything in Quick Understanding and adds guided understanding checks.

Required output:

- 3-5 key points.
- 2-3 common misunderstandings.
- 5-8 multiple-choice questions.
- Each question has 4 options, one correct answer, and an explanation.
- Questions must cover definition, boundaries, misunderstandings, application scenarios, and counterexamples.

Question behavior:

- The user selects one answer.
- If correct, the UI shows a short reinforcement explanation.
- If incorrect, the UI explains why the selected option is wrong and why the correct option is right.
- Answering questions does not call the AI again; the frontend uses explanations returned in the structured response.

### Mastery

This mode includes everything in Deep Understanding and adds a Feynman-style explanation exercise.

Required output:

- A Feynman prompt asking the user to explain the concept in their own words.
- 3-5 expected explanation points that the user's answer should ideally cover.

Feynman feedback behavior:

- The user writes an explanation.
- The backend sends the explanation and the learning session context to the AI.
- The AI returns feedback across accuracy, missing points, and clarity.
- This feedback does not deduct extra quota.
- The MVP supports one feedback response per Mastery learning session. Multi-round student roleplay can be added later.

## Explanation Quality Rules

The extension's differentiation depends on explanation quality, not just AI access. The backend prompt and response validator should enforce these rules:

- The AI must identify what the selected term is before defining it.
- The AI must respond in Simplified Chinese even when the selected term is English.
- The AI should preserve the original English term and give a natural Chinese name or translation when helpful.
- The definition must avoid unexplained jargon.
- The background must explain whether the term is a tool, mechanism, method, English translation, abbreviation, or industry phrase.
- Examples must be simple, concrete, and life-like.
- Examples must be conceptually accurate, not merely entertaining.
- Each example must include a mapping back to the concept.
- For complex business, product, or technical terms, the example should prefer everyday scenes, work scenes, or learning scenes.
- The AI should avoid abstract corporate wording when a concrete example can explain the idea.

Example quality target:

For "demand mining" or "demand drilling", a good example is: a user says they want a faster horse, but the real need is not the horse itself; the real need is to reach the destination faster, so a car may solve the underlying need better. This kind of example is preferred because it is concrete, easy to picture, and directly maps surface demand to underlying need.

## AI Response Structure

The backend asks the AI model for structured JSON and validates it before returning content to the extension.

Quick Understanding response shape:

```json
{
  "concept_validity": {
    "is_valid": true,
    "reason": "The selected text is a recognizable product term."
  },
  "original_term": "demand mining",
  "chinese_display_name": "需求挖掘",
  "concept_type": "方法",
  "background": "这个词常出现在产品、用户研究和需求分析场景中，用来提醒人们不要只停留在用户表面说法。",
  "plain_definition": "需求挖掘就是从用户说出来的要求里，继续追问和判断他们真正想解决的问题。",
  "simple_example": "用户说想要一匹更快的马，但他真正想要的可能是更快到达目的地，所以车可能是更好的方案。",
  "example_mapping": "快马是表面需求，更快到达目的地是真实需求，车是围绕真实需求找到的新方案。"
}
```

Deep Understanding extends the same shape:

```json
{
  "key_points": ["要点 1", "要点 2", "要点 3"],
  "common_misunderstandings": ["常见误区 1", "常见误区 2"],
  "quiz": [
    {
      "id": "q1",
      "question": "以下哪一种最接近需求挖掘的意思？",
      "options": [
        { "id": "A", "text": "把用户原话整理成列表" },
        { "id": "B", "text": "继续追问用户背后的真实问题" },
        { "id": "C", "text": "尽快做出用户说的功能" },
        { "id": "D", "text": "把所有需求都交给研发判断" }
      ],
      "correct_option_id": "B",
      "explanation": "B 对，因为需求挖掘关注的是表面表达背后的真实目标；A 和 C 都太停留在用户原话，D 则把判断责任转移出去了。"
    }
  ]
}
```

Mastery extends Deep Understanding:

```json
{
  "feynman_prompt": "请你用自己的话解释这个概念，就像讲给一个刚入门的朋友听。",
  "expected_explanation_points": ["说明它解决什么问题", "区分表面说法和真实需求", "用一个简单例子讲清楚"]
}
```

Feynman feedback response shape:

```json
{
  "understanding_score": 82,
  "what_is_clear": "用户已经讲清楚的地方。",
  "missing_or_wrong": "遗漏、模糊或不准确的地方。",
  "better_explanation": "一版更清楚、更像人话的改写。",
  "next_question": "一个有助于继续思考的追问。"
}
```

## Visual Direction

The visual style follows the user's reference image: quiet, clean, soft, and restrained.

Design tokens:

- Background: warm off-white, close to `#F7F7F4`.
- Main surface: white.
- Border: soft gray, close to `#E7E7E2`.
- Primary text: near black, close to `#1F1F1D`.
- Secondary text: muted gray, close to `#8A8A84`.
- Primary accent: soft fluorescent green, close to `#D9FF63`.
- Error accent: soft red, close to `#F36B6B`, paired with a pale red background.
- Memory-potion image accent: translucent blue-cyan to blue-green, with sparse dark-blue halftone dots.

Shape and spacing:

- The side panel itself is attached to the browser right edge and does not need a large outer radius.
- Internal modules, inputs, buttons, and quiz options use 12-20px radii.
- Tags, tabs, and memory-potion quota badges use pill shapes.
- Borders and separators are light.
- Shadows are subtle and used sparingly.

Memory-potion bottle style:

- The potion bottle should follow the user's second visual reference direction: halftone dot matrix, translucent scan-like texture, pale blue/cyan/green tones, and light editorial/technical restraint.
- It should not be a cartoon fantasy potion bottle. Avoid thick outlines, shiny game-style highlights, stars, sparkles, or ornate magic props.
- Use it as a small quota/icon asset in the side panel, empty states, and invite success states. It should support the "memory potion" metaphor without competing with the learning content.
- The bottle can be rendered as a lightweight CSS/SVG-style icon for MVP. If a richer generated bitmap is added later, it should preserve the same halftone specimen style and transparent/white background compatibility.

Interaction style:

- Use segmented pill tabs for the three learning modes.
- Use icon buttons where the action is familiar.
- Use clear text buttons for generation, retry, and feedback submission.
- Use lightweight skeleton loading states while generating.
- Avoid purple-blue AI gradients, decorative blobs, and heavy card stacking.
- The interface should feel like a quiet learning drawer, not a marketing page.

## Frontend Architecture

The extension uses Chrome Manifest V3 with React and TypeScript.

Main parts:

- Background service worker: creates the context menu, receives right-click events, coordinates messages, and opens the side panel.
- Content script: extracts selected text, nearest paragraph, page title, and URL from the active page.
- Side panel app: handles invite-code activation, memory-potion quota display, mode switching, content rendering, quiz interaction, Feynman input, loading states, and errors.
- API client: stores the access token locally and communicates with the backend.

The side panel should preserve the current learning session while open. It should not require regeneration when the user merely answers quiz questions or writes a Feynman explanation.

## Backend Architecture

The backend uses Node.js with Fastify.

Responsibilities:

- Validate invite codes.
- Issue lightweight access tokens.
- Check and deduct quota atomically.
- Build AI prompts by mode.
- Validate AI JSON responses.
- Retry once if the AI response is malformed.
- Save learning sessions and feedback.
- Return consistent errors to the extension.

The backend owns all AI credentials. The extension never stores or exposes model API keys.

## Database Design

SQLite is sufficient for local development and a small private beta. The data model should be easy to migrate to PostgreSQL later.

### `invite_codes`

- `id`
- `code`
- `total_credits`
- `remaining_credits`
- `is_active`
- `created_at`
- `activated_at`
- `last_used_at`

### `learning_sessions`

- `id`
- `invite_code_id`
- `selected_text`
- `paragraph_context`
- `page_title`
- `page_url`
- `mode`
- `ai_response_json`
- `credit_deducted`
- `error_code`
- `created_at`

### `feynman_feedbacks`

- `id`
- `learning_session_id`
- `user_explanation`
- `ai_feedback_json`
- `created_at`

## API Design

### `POST /api/invite/activate`

Request:

```json
{
  "code": "INVITE-CODE"
}
```

Response:

```json
{
  "token": "access-token",
  "remaining_credits": 5
}
```

### `POST /api/learn`

Request:

```json
{
  "selected_text": "demand mining",
  "paragraph_context": "The paragraph where the concept appears.",
  "page_title": "Article title",
  "page_url": "https://example.com/article",
  "mode": "quick"
}
```

Response:

```json
{
  "session_id": "session-id",
  "remaining_credits": 4,
  "content": {}
}
```

### `POST /api/feynman-feedback`

Request:

```json
{
  "session_id": "session-id",
  "user_explanation": "The user's explanation in their own words."
}
```

Response:

```json
{
  "feedback": {}
}
```

## Error Handling

Frontend states:

- No invite code: show invite-code input screen.
- Invalid or disabled invite code: show a clear retry message.
- No selected text: ask the user to select a specific concept.
- Selected text too long: ask the user to select a shorter concept term.
- Unsupported page: explain that this page does not allow the extension to read selection context.
- No quota: show `还剩 0 瓶记忆药水` and block generation.
- AI or network failure: show retry action and do not deduct quota.
- Malformed AI response after retry: show retry action and do not deduct quota.

Backend error principles:

- Validate quota before calling AI.
- Deduct quota only after a valid AI response has been produced and stored.
- Use a database transaction for quota deduction and session creation.
- Return stable error codes so the side panel can render friendly messages.

## Testing Plan

Frontend tests:

- Context menu appears only when text is selected.
- Side panel opens from the right-click action.
- Content script extracts selected text, paragraph, title, and URL.
- Invite token and memory-potion quota are stored and restored.
- Mode switching renders the correct sections.
- Quiz selection shows immediate correct and incorrect explanations.
- Feynman input submits feedback and renders the result.
- A Mastery learning session accepts only one Feynman feedback response in the MVP.
- English selected terms still render Chinese explanations, quiz questions, options, explanations, Feynman prompts, and feedback.

Backend tests:

- Invite activation works for active codes.
- Invalid and disabled codes are rejected.
- Learning generation fails before AI call when quota is 0.
- Successful generation deducts exactly 1 credit.
- AI failure does not deduct credit.
- Malformed AI response triggers one retry.
- Failed retry does not deduct credit.
- Feynman feedback does not deduct credit.
- A second Feynman feedback request for the same Mastery session is rejected.
- AI prompt and response validation enforce Simplified Chinese output for English selected terms.

End-to-end tests:

- Select a concept on a sample page, right-click, open side panel, generate Quick Understanding, and observe quota decrement.
- Switch to Deep Understanding and answer a quiz question.
- Generate Mastery content and submit a Feynman explanation.
- Exhaust quota and confirm generation is blocked.

Visual checks:

- Side panel follows the quiet white, gray, and soft-green style.
- Text fits inside buttons, quiz options, and cards.
- The side panel remains usable on desktop Chrome viewport widths.
- The MVP does not target mobile or narrow responsive layouts.

## Launch Plan

The first launch should be a controlled private beta.

- Generate a small batch of invite codes manually.
- Give each invite code 5 credits, displayed as 5 bottles of memory potion.
- Distribute the unpacked Chrome extension or a signed beta build to testers.
- Deploy the backend on a lightweight platform such as Render, Railway, or Fly.io.
- Review whether testers use all 5 credits and which concepts they choose.
- Improve prompt quality before adding payments or account systems.

## Open Follow-Ups After MVP

Potential next steps after validation:

- Upgrade invite-code identity to real user accounts.
- Add paid credits or subscription plans.
- Add concept history and personal learning logs.
- Add spaced repetition for missed quiz questions.
- Add multi-round Feynman student roleplay.
- Support article summarization around a cluster of concepts.
- Add admin tooling for invite codes and usage analytics.
