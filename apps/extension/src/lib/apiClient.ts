import type {
  ActivateInviteResponse,
  FeynmanFeedbackRequest,
  FeynmanFeedbackResponse,
  LearnRequest,
  LearnResponse
} from "@memora/shared";

export interface TokenStore {
  getToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  activateInvite(code: string): Promise<ActivateInviteResponse>;
  learn(requestBody: LearnRequest): Promise<LearnResponse>;
  submitFeynmanFeedback(requestBody: FeynmanFeedbackRequest): Promise<FeynmanFeedbackResponse>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/g, "");
}

function errorMessageFromPayload(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "object" && error !== null) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }
  return "请求失败，请稍后重试。";
}

export function createApiClient(baseUrl: string, tokenStore: TokenStore): ApiClient {
  const fetchImpl = tokenStore.fetchImpl ?? fetch;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, body: unknown, auth: boolean): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      const token = await tokenStore.getToken();
      if (!token) {
        throw new Error("请先输入邀请码。");
      }
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(errorMessageFromPayload(payload));
    }
    return payload as T;
  }

  return {
    async activateInvite(code: string): Promise<ActivateInviteResponse> {
      const response = await request<ActivateInviteResponse>(
        "/api/invite/activate",
        { code },
        false
      );
      await tokenStore.saveToken(response.token);
      return response;
    },

    learn(requestBody: LearnRequest): Promise<LearnResponse> {
      return request<LearnResponse>("/api/learn", requestBody, true);
    },

    submitFeynmanFeedback(
      requestBody: FeynmanFeedbackRequest
    ): Promise<FeynmanFeedbackResponse> {
      return request<FeynmanFeedbackResponse>("/api/feynman-feedback", requestBody, true);
    }
  };
}
