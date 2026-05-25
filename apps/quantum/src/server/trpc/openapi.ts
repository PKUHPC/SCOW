import { joinWithUrl } from "@scow/utils";
import { type NextApiRequest } from "next";
import { config } from "src/server/config/env";
import { BASE_PATH } from "src/utils/processEnv";
import { generateOpenApiDocument } from "trpc-to-openapi";

import { appRouter } from "./router";

const getHeaderValue = (header: string | string[] | undefined) => (Array.isArray(header) ? header[0] : header);

const getBaseUrl = (req: Pick<NextApiRequest, "headers">) => {
  const host = getHeaderValue(req.headers.host);
  const origin = host ? `${config.PROTOCOL || "http"}://${host}` : "";

  return joinWithUrl(origin, BASE_PATH, "/api");
};

// Generate OpenAPI schema document
export const createOpenApiDocument = (req: Pick<NextApiRequest, "headers">) =>
  generateOpenApiDocument(appRouter, {
    title: "SCOW Quantum API",
    description: "HTTP API for SCOW Quantum",
    version: "1.0.0",
    baseUrl: getBaseUrl(req),
    tags: ["quantum"],
  });
