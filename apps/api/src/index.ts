import { loadConfig } from "./config";
import { createConfiguredServer } from "./runtime";

const config = loadConfig();
const app = await createConfiguredServer();
await app.listen({ port: config.port, host: "0.0.0.0" });
