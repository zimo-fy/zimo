import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { ErrorBoundary } from "./components/error-boundary";
import "./styles.css";
import "@xyflow/react/dist/style.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
