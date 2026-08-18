import "antd/dist/reset.css";
import "src/styles/global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "src/app/App";
import "src/i18n";
import { queryClient } from "src/queryClient";
import { RuntimeThemeProvider } from "src/theme/RuntimeThemeProvider";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RuntimeThemeProvider>
        <BrowserRouter basename={basePath || "/"}>
          <App />
        </BrowserRouter>
      </RuntimeThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
