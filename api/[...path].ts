import { createConfiguredServer } from "../apps/api/dist/runtime.js";

export default async function handler(request: unknown, response: unknown): Promise<void> {
  const app = await createConfiguredServer();
  await app.ready();
  app.server.emit("request", request, response);
}
