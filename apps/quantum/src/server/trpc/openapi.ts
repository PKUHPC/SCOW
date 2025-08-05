import { generateOpenApiDocument } from "trpc-openapi";

import { appRouter } from "./router";

// Generate OpenAPI schema document
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "SCOW Quantum API",
  description: "HTTP API for SCOW Quantum",
  version: "1.0.0",
  baseUrl: "http://localhost:5007/api",
  docsUrl: "https://github.com/jlalmes/trpc-openapi",
  tags: ["quantum"],
});
