import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { FeynmanFeedbackRequest, LearnRequest, LearningMode } from "@memora/shared";
import { createConfiguredAiProvider } from "./ai/configuredProvider.js";
import type { AiProvider } from "./ai/provider.js";
import { MockAiProvider } from "./ai/mockProvider.js";
import { authenticateRequest } from "./auth/authMiddleware.js";
import { loadConfig } from "./config.js";
import { createAppDatabase } from "./db/appDatabase.js";
import type { AppDatabase } from "./db/database.js";
import { migrateDatabase, seedMainInviteCode } from "./db/schema.js";
import { submitFeynmanFeedback } from "./feynman/feynmanService.js";
import { activateInvite, ApiError } from "./invites/inviteService.js";
import { generateLearning } from "./learning/learningService.js";

const privacyPolicyHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Memora 隐私政策</title>
    <style>
      :root {
        color: #202833;
        background: #f6f7f4;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
      }

      body {
        margin: 0;
        padding: 48px 20px;
      }

      main {
        width: min(820px, 100%);
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dfe3da;
        border-radius: 28px;
        padding: clamp(28px, 5vw, 52px);
        box-shadow: 0 24px 70px rgb(32 40 51 / 8%);
      }

      h1 {
        margin: 0 0 10px;
        font-size: clamp(34px, 6vw, 56px);
        letter-spacing: 0;
      }

      h2 {
        margin-top: 34px;
        font-size: 22px;
      }

      p,
      li {
        color: #4f554d;
        font-size: 17px;
        line-height: 1.75;
      }

      .updated {
        color: #8d9288;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Memora 隐私政策</h1>
      <p class="updated">更新日期：2026 年 7 月 1 日</p>

      <h2>我们处理哪些信息</h2>
      <p>
        当你主动选择网页文字并使用 Memora 学习时，Memora 会处理你选中的词语、附近段落、页面标题、页面链接、学习模式、邀请码状态，以及 AI 生成的学习内容和费曼反馈。
      </p>

      <h2>我们如何使用这些信息</h2>
      <p>
        这些信息只用于生成中文概念解释、选择题、费曼学习反馈、邀请码额度管理、服务稳定性排查和防滥用。Memora 不会在你未主动触发学习时读取网页内容。
      </p>

      <h2>第三方 AI 服务</h2>
      <p>
        为了生成学习内容，Memora 后端可能会把你主动提交的选中文字和必要上下文发送给已配置的 AI 服务商。AI 密钥只保存在 Memora 后端，不会写入浏览器插件。
      </p>

      <h2>数据保存</h2>
      <p>
        Memora 会保存邀请码额度和学习记录，用于避免重复扣除、支持缓存和排查服务问题。我们不会出售你的个人数据。
      </p>

      <h2>你的选择</h2>
      <ul>
        <li>你可以不选择文字，也可以不触发 Memora 学习。</li>
        <li>你可以卸载浏览器插件来停止继续使用 Memora。</li>
        <li>如需删除与你的邀请码相关的学习记录，请通过 Chrome Web Store 开发者联系方式联系我们。</li>
      </ul>
    </main>
  </body>
</html>`;

export interface ServerDependencies {
  db: AppDatabase;
  aiProvider?: AiProvider;
}

function inviteCodeFromBody(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "";
  }
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function learnRequestFromBody(body: unknown): LearnRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      selected_text: "",
      paragraph_context: "",
      page_title: "",
      page_url: "",
      mode: "quick"
    };
  }

  const requestBody = body as Record<string, unknown>;
  const mode = requestBody.mode;

  return {
    selected_text:
      typeof requestBody.selected_text === "string" ? requestBody.selected_text : "",
    paragraph_context:
      typeof requestBody.paragraph_context === "string" ? requestBody.paragraph_context : "",
    page_title: typeof requestBody.page_title === "string" ? requestBody.page_title : "",
    page_url: typeof requestBody.page_url === "string" ? requestBody.page_url : "",
    mode:
      mode === "quick" || mode === "deep" || mode === "mastery"
        ? (mode as LearningMode)
        : "quick"
  };
}

function feynmanFeedbackRequestFromBody(body: unknown): FeynmanFeedbackRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      session_id: "",
      user_explanation: ""
    };
  }

  const requestBody = body as Record<string, unknown>;
  return {
    session_id: typeof requestBody.session_id === "string" ? requestBody.session_id : "",
    user_explanation:
      typeof requestBody.user_explanation === "string" ? requestBody.user_explanation : ""
  };
}

export function buildServer({ db, aiProvider = new MockAiProvider() }: ServerDependencies) {
  const app = Fastify({ logger: false });

  const healthResponse = async () => {
    return {
      status: "ok",
      service: "memora-api"
    };
  };

  app.get("/", healthResponse);
  app.get("/health", healthResponse);
  app.get("/api/health", healthResponse);
  app.get("/privacy.html", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(privacyPolicyHtml);
  });
  app.get("/privacy", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(privacyPolicyHtml);
  });

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
    return await activateInvite(db, inviteCodeFromBody(request.body));
  });

  app.get("/api/me", async (request) => {
    const invite = await authenticateRequest(db, request);
    return {
      code: invite.code,
      remaining_credits: invite.remaining_credits
    };
  });

  app.post("/api/learn", async (request) => {
    const invite = await authenticateRequest(db, request);
    return generateLearning(db, aiProvider, invite, learnRequestFromBody(request.body));
  });

  app.post("/api/feynman-feedback", async (request) => {
    const invite = await authenticateRequest(db, request);
    return submitFeynmanFeedback(
      db,
      aiProvider,
      invite,
      feynmanFeedbackRequestFromBody(request.body)
    );
  });

  return app;
}

let vercelServerPromise: Promise<FastifyInstance> | undefined;

async function createVercelServer(): Promise<FastifyInstance> {
  if (!vercelServerPromise) {
    vercelServerPromise = (async () => {
      const config = loadConfig();
      const db = await createAppDatabase(config);
      await migrateDatabase(db);
      await seedMainInviteCode(db, config.mainInviteCode);
      return buildServer({ db, aiProvider: createConfiguredAiProvider(config) });
    })();
  }

  return vercelServerPromise;
}

export default async function handler(request: unknown, response: unknown): Promise<void> {
  const app = await createVercelServer();
  await app.ready();
  app.server.emit("request", request, response);
}
