import Fastify from "fastify";
import type { FeynmanFeedbackRequest, LearnRequest, LearningMode } from "@memora/shared";
import type { AiProvider } from "./ai/provider.js";
import { MockAiProvider } from "./ai/mockProvider.js";
import { authenticateRequest } from "./auth/authMiddleware.js";
import type { AppDatabase } from "./db/database.js";
import { submitFeynmanFeedback } from "./feynman/feynmanService.js";
import { activateInvite, ApiError } from "./invites/inviteService.js";
import { generateLearning } from "./learning/learningService.js";

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

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "memora-api"
    };
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
