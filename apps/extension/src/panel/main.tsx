import React from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "../lib/apiClient";
import { loadPendingSelection, loadToken, saveToken } from "../lib/sessionStore";
import { App } from "./App";
import "./styles.css";

async function bootstrap() {
  const root = createRoot(document.getElementById("root") as HTMLElement);
  const initialSelection = await loadPendingSelection();
  const initialToken = await loadToken();
  const apiClient = createApiClient(
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787",
    {
      getToken: loadToken,
      saveToken
    }
  );

  root.render(
    <React.StrictMode>
      <App apiClient={apiClient} initialSelection={initialSelection} initialToken={initialToken} />
    </React.StrictMode>
  );
}

void bootstrap();
