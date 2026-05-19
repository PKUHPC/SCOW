import { Static, TSchema } from "@sinclair/typebox";
import fs from "fs";
import { load } from "js-yaml";
import { basename, extname, join } from "path";
import { Logger } from "ts-log";

import { validateObject } from "./validation";

const parsers = {
  yml: load,
  yaml: load,
  json: JSON.parse,
};

const candidates = Object.entries(parsers);

/**
 * 从具体的文件中读取配置
 * @param schema JSON Schema对象
 * @param filePath 文件路径
 * @returns 配置对象
 * @throws 如果配置文件不存在，或者不匹配格式，抛出异常
 */
export function getConfig<T extends TSchema>(schema: T, filePath: string): Static<T> {
  // extname returns .yml
  const ext = extname(filePath).substring(1);

  if (!(ext in parsers)) {
    throw new Error(`Unsupported config file extension ${ext}`);
  }

  const content = fs.readFileSync(filePath, { encoding: "utf8" });

  const result = validateObject(schema, parsers[ext](content));
  if (result instanceof Error) {
    throw new Error("Error reading config file " + filePath + ": " + result.message);
  }
  return result;
}

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

/**
 * 从文件中读取配置。
 * 读取优先级：yml -> yaml -> json
 *
 * @param schema JSON Schema对象
 * @param filename 文件名，不要带扩展名
 * @param basePath 配置文件路径。当NODE_ENV === production时，默认为/etc/scow, 否则为$PWD/config
 * @returns 配置对象
 * @throws 如果配置文件不存在，抛出异常
 */
export function getConfigFromFile<T extends TSchema>(schema: T, filename: string, basePath: string): Static<T> {
  for (const [ext, loader] of candidates) {
    const path = join(basePath, filename + "." + ext);
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, { encoding: "utf8" });
      const obj = validateObject(schema, loader(content));
      if (obj instanceof Error) {
        throw new ConfigFileSchemaError(path, obj);
      }
      return obj;
    }
  }

  throw new ConfigFileNotExistError(filename, basePath);
}

/**
 * 从目录中读取配置。
 * 返回的对象为配置ID->配置对象的映射
 * 配置ID为目录下的配置文件名（不包括扩展名）、或者包含config.yaml/yml/json的目录名。
 * 当目录下同时存在文件和目录时，目录下的config配置文件优先。
 *
 * 例如，当目录中有文件a.yml, b.yaml, c/config.json, c.yaml时，返回的对象为 {a: ..., b: ..., c: c/config.json的配置}
 *
 * 读取优先级：yml -> yaml -> json
 * 文件名作为配置ID，不要带扩展名
 *
 * @param schema 配置文件的JSON Schema
 * @param dir 配置文件所在的目录
 * @param basePath 配置目录
 * @param logger 日志对象
 * @returns 配置文件的ID到配置对象的映射
 */
export function getDirConfig<T extends TSchema>(
  schema: T,
  dir: string,
  basePath: string,
  logger?: Logger,
): Record<string, Static<T>> {
  const configDir = join(basePath, dir);

  if (!fs.existsSync(configDir)) {
    return {};
  }

  const files = fs.readdirSync(configDir);

  const result = {};

  for (const filename of files) {
    const fullPath = join(configDir, filename);

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      try {
        const subDirConfigFilePath = join(dir, filename, "config");
        const config = getConfigFromFile(schema, subDirConfigFilePath, basePath);
        logger?.debug("Read dir config %s of id %s from %s", dir, filename, subDirConfigFilePath);
        result[filename] = config;
        continue;
      } catch (e) {
        if (!(e instanceof ConfigFileNotExistError)) {
          throw e;
        }
      }
    } else {
      const ext = extname(filename);

      const id = basename(filename, ext);

      if (!parsers[ext.substring(1)]) {
        logger?.debug("Ignore config file %s with unknown extension name %s", filename, ext);
        continue;
      }

      if (id in result) {
        continue;
      }

      logger?.debug("Read dir config %s of id %s from %s", dir, id, fullPath);
      const config = getConfig(schema, fullPath);
      result[id] = config;
    }
  }

  return result;
}

export type GetConfigFn<T> = (baseConfigPath?: string, logger?: Logger) => T;
