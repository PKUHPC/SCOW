import { NextApiRequest, NextApiResponse } from "next";
import { openapiRoutes } from "src/server/openapi-registry";
import { buildOpenApiSpec } from "@scow/lib-web/build/utils/typebox-to-openapi";

let cachedSpec: object | undefined;

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (!cachedSpec) {
    cachedSpec = buildOpenApiSpec(openapiRoutes, {
      title: "SCOW Portal API",
      version: "1.0.0",
    });
  }
  res.status(200).json(cachedSpec);
}
