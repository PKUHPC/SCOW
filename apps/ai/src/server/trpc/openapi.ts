import { generateOpenApiDocument } from "trpc-to-openapi";

import { appRouter } from "./router";

// Generate OpenAPI schema document
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "SCOW AI API",
  description: "HTTP API for SCOW AI",
  version: "1.0.0",
  baseUrl: "http://localhost:5006/api",
  docsUrl: "https://github.com/jlalmes/trpc-to-openapi",
  tags: ["ai"],
});
