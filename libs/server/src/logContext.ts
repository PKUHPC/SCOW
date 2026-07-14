import { Plugin } from "@ddadaal/tsgrpc-server";
import { AsyncLocalStorage } from "async_hooks";
import pino from "pino";

export const logContextFieldNames = ["userId", "tenantName", "accountName", "cluster", "clusterId"] as const;

export type LogContextFieldName = (typeof logContextFieldNames)[number];
export type LogContext = Partial<Record<LogContextFieldName | "req" | "path", string>>;

export interface LoggerConfig {
  LOG_LEVEL: string;
  LOG_PRETTY: boolean;
}

export function createLoggerOptions(config: LoggerConfig): pino.LoggerOptions {
  return {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin: () => getActiveLogContext(),
    ...(config.LOG_PRETTY
      ? {
          transport: { target: "pino-pretty" },
        }
      : {}),
  };
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

export function getActiveLogContext(): LogContext {
  return logContextStorage.getStore() ?? {};
}

export function enterLogContext(context: LogContext): void {
  const activeContext = getActiveLogContext();
  logContextStorage.enterWith({ ...activeContext, ...context });
}

export function runWithLogContext<T>(context: LogContext, callback: () => T): T {
  const activeContext = getActiveLogContext();
  return logContextStorage.run({ ...activeContext, ...context }, callback);
}

export function extractLogContext(input: unknown): LogContext {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;

  return logContextFieldNames.reduce<LogContext>((result, field) => {
    const value = source[field];

    if (typeof value === "string" && value.trim().length > 0) {
      result[field] = value;
    }

    return result;
  }, {});
}

export function withLogContext(logger: pino.Logger, context: LogContext): pino.Logger {
  return Object.keys(context).length > 0 ? logger.child(context) : logger;
}

export const requestLogContextPlugin: Plugin = (server) => {
  server.addRequestHook((call) => {
    const bindings = call.logger.bindings();
    const request = "request" in call ? call.request : undefined;
    const context = extractLogContext(request);

    enterLogContext({
      req: typeof bindings.req === "string" ? bindings.req : undefined,
      path: typeof bindings.path === "string" ? bindings.path : undefined,
      ...context,
    });

    call.logger = withLogContext(call.logger, context);
  });
};
