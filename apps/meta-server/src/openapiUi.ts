import { createReadStream, statSync } from "fs";
import { extname, isAbsolute, relative, resolve, sep } from "path";
import { FastifyReply } from "fastify";
import swaggerUiDist from "swagger-ui-dist";

import { metaBasePath } from "./paths";

const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
};

function getContentType(filePath: string) {
  return contentTypes[extname(filePath)] ?? "application/octet-stream";
}

export function createOpenApiHtml(basePath: string) {
  const openApiJsonPath = `${metaBasePath(basePath)}/api/openapi.json`;
  const assetBasePath = `${metaBasePath(basePath)}/openapi`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SCOW API</title>
    <link rel="stylesheet" href="${assetBasePath}/swagger-ui.css" />
    <link rel="icon" type="image/png" href="${assetBasePath}/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="${assetBasePath}/favicon-16x16.png" sizes="16x16" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${assetBasePath}/swagger-ui-bundle.js"></script>
    <script src="${assetBasePath}/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(openApiJsonPath)},
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset,
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
        ],
        layout: "StandaloneLayout",
      });
    </script>
  </body>
</html>`;
}

export function sendSwaggerUiAsset(reply: FastifyReply, assetPathname: string) {
  const assetName = assetPathname || "index.html";
  const filePath = resolve(swaggerUiPath, assetName);
  const relativePath = relative(swaggerUiPath, filePath);

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return reply.code(404).send();
  }

  try {
    if (!statSync(filePath).isFile()) {
      return reply.code(404).send();
    }
  } catch {
    return reply.code(404).send();
  }

  return reply.type(getContentType(filePath)).send(createReadStream(filePath));
}
