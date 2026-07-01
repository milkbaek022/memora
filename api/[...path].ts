import { createConfiguredServer } from "../apps/api/src/runtime";

export default async function handler(request: unknown, response: unknown): Promise<void> {
  const app = await createConfiguredServer();
  await app.ready();
  app.server.emit("request", request, response);
}
