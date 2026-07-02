import { loadConfig } from "./config.js";
import { createConfiguredServer } from "./runtime.js";

const config = loadConfig();
const app = await createConfiguredServer();
await app.listen({ port: config.port, host: "0.0.0.0" });
