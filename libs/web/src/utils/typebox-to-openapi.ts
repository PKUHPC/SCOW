import type { TypeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import type { TObject } from "@sinclair/typebox";

export interface RouteEntry {
  schema: TypeboxRouteSchema;
  method: string;
  url: string;
}

function cleanSchema(schema: unknown): unknown {
  return JSON.parse(JSON.stringify(schema));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNullSchema(schema: unknown): boolean {
  return isRecord(schema) && schema.type === "null";
}

function convertSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(convertSchema);
  }

  if (!isRecord(schema)) {
    return schema;
  }

  const converted = Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, convertSchema(value)]));

  delete converted.$id;
  if (typeof converted.$ref === "string" && !converted.$ref.startsWith("#/")) {
    delete converted.$ref;
  }

  return converted;
}

function toOpenApiSchema(schema: unknown): unknown {
  return convertSchema(cleanSchema(schema));
}

function queryToParameters(query: TObject): object[] {
  const required = new Set(query.required ?? []);
  return Object.entries(query.properties ?? {}).map(([name, propSchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: toOpenApiSchema(propSchema),
  }));
}

function toOpenApiResponse(code: string, schema: unknown): object {
  const response: Record<string, unknown> = { description: code };

  if (!isNullSchema(schema)) {
    response.content = { "application/json": { schema: toOpenApiSchema(schema) } };
  }

  return response;
}

export function buildOpenApiSpec(routes: RouteEntry[], info: { title: string; version: string; description?: string }) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const { schema, method, url } of routes) {
    const op: Record<string, unknown> = {};

    if (schema.query) {
      op.parameters = queryToParameters(schema.query as TObject);
    }

    if (schema.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: toOpenApiSchema(schema.body) } },
      };
    }

    op.responses = Object.fromEntries(
      Object.entries(schema.responses).map(([code, respSchema]) => [code, toOpenApiResponse(code, respSchema)]),
    );

    const normalizedUrl = url.replace(/\/\/+/g, "/");
    if (!paths[normalizedUrl]) paths[normalizedUrl] = {};
    paths[normalizedUrl][method.toLowerCase()] = op;
  }

  return { openapi: "3.1.0", info, paths };
}
