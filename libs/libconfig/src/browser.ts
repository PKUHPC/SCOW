import { Static, TSchema } from "@sinclair/typebox";
import { Logger } from "ts-log";

export type { Validator } from "./envConfig";
export { bool, envConfig, host, num, omitConfigSpec, port, regex, str, url } from "./envConfig";
export { parseArray, parseKeyValue, parsePlaceholder } from "./parse";
export { createAjv, validateObject } from "./validation";

export class ConfigFileSchemaError extends Error {
  constructor(
    public readonly path: string,
    public readonly cause: Error,
  ) {
    super(`Error reading config file ${path}: ${cause.message}`, { cause });
  }
}

export class ConfigFileNotExistError extends Error {
  constructor(
    public readonly filename: string,
    public readonly basePath: string,
  ) {
    super(`config ${filename} doesn't exist in ${basePath}`);
  }
}

function fileConfigUnavailable(): never {
  throw new Error("File config APIs are only available in Node.js.");
}

export function getConfigFromFile<T extends TSchema>(
  _schema: T,
  _filename: string,
  _basePath: string,
): Static<T> {
  return fileConfigUnavailable();
}

export function getDirConfig<T extends TSchema>(
  _schema: T,
  _dir: string,
  _basePath: string,
  _logger?: Logger,
): Record<string, Static<T>> {
  return fileConfigUnavailable();
}

export type GetConfigFn<T> = (baseConfigPath?: string, logger?: Logger) => T;
