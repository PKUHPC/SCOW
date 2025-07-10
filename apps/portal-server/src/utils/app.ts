import { ConnectError } from "@connectrpc/connect";
import { ServiceError } from "@grpc/grpc-js";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FixedValue } from "@scow/protos/build/portal/app";
import fs from "fs";
import { join } from "path";
import { getAppConfigs } from "src/config/apps";
import { config } from "src/config/env";
import { Logger } from "ts-log";
import { z } from "zod";

import { mapConnectRpcStatusToGrpc } from "./scowd";


export const SessionMetadataSchema = z.object({
  sessionId: z.string(),
  // 兼容原始没有 jobName 的数据
  jobName: z.string().optional(),
  jobId: z.number(),
  appId: z.string(),
  submitTime: z.string(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

// All keys are strings except PORT
export interface ServerSessionInfoData {
  [key: string]: string | number | undefined;
  HOST: string;
  PORT: number;
  PASSWORD?: string;
}

export interface ShadowDeskSession {
  [key: string]: string | number;
  SHADOWDESK_USER: string;
}

export const SERVER_ENTRY_COMMAND = fs.readFileSync("assets/slurm/server_entry.sh", { encoding: "utf-8" });
export const VNC_ENTRY_COMMAND = fs.readFileSync("assets/slurm/vnc_entry.sh", { encoding: "utf-8" });

export const VNC_OUTPUT_FILE = "output";

export const SESSION_METADATA_NAME = "session.json";

export const SERVER_SESSION_INFO = "server_session_info.json";
export const SHADOWDESK_SESSION = "shadowdesk_session.json";
export const VNC_SESSION_INFO = "VNC_SESSION_INFO";

export const APP_LAST_SUBMISSION_INFO = "last_submission.json";
export const BIN_BASH_SCRIPT_HEADER = "#!/bin/bash -l\n";

// 已完成的交互式应用作业，保存相关信息到ended_sessions.json
export const ENDED_SESSIONS = "ended_sessions.json";


export function splitSbatchArgs(sbatchArgs: string) {
  const args = sbatchArgs.split(" -").map(function(x, index) {
    x = x.trim();
    return index === 0 ? x : "-" + x;
  });
  return args.filter((x) => x); // remove empty string in the array
}


export const getClusterAppConfigs = (cluster: string) => {

  const commonApps = getAppConfigs();

  const clusterAppsConfigs = getAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps = {} as Record<string, typeof commonApps[number]>;

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;

};




interface FixedValueInput {
  value: string | number | undefined;
  hidden?: boolean
}
type OutputValue = FixedValue["value"];

export function convertAttributesFixedValue(input: FixedValueInput | undefined):
{ value: OutputValue; hidden: boolean } | undefined {
  if (input?.value === undefined) {
    return undefined;
  }

  const fixedValue: OutputValue =
    typeof input.value === "number"
      ? { $case: "number", number: input.value }
      : { $case: "text", text: input.value };

  return { value: fixedValue, hidden: input.hidden ?? false };
}

export function camelToSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}


export function convertToOneOfValue(value: string | number):
   { $case: "number", number: number } | { $case: "text", text: string } {
  if (typeof value === "number") {
    return { $case: "number", number: value };
  } else {
    return { $case: "text", text: value };
  }
}

/**
 * 解析 ended_sessions.json文件内容，返回session metadata数组
 * 每一行增加zod验证，忽略出现错误的行数
 * @param endedSessionsContent
 * @param logger
 * @returns
 */
function parseAndValidateSessionsFileContent(
  endedSessionsContent: string[],
  logger: Logger,
): SessionMetadata[] {
  return endedSessionsContent
    .filter((line) => line && line.trim() !== "")
    .map((line) => {
      try {
        const parseData = JSON.parse(line);
        // 增加zod验证
        const validationResult = SessionMetadataSchema.safeParse(parseData);
        if (validationResult.success) {
          return validationResult.data;
        } else {
          return null;
        }

      } catch (error) {
        logger.warn(`Failed to parse endedSession's line: ${line}`, error);
        return null;
      }
    })
  // 将解析失败的行过滤掉
    .filter((item): item is SessionMetadata => item !== null);
}


/**
 * 由于 grpc-proto 的 4M 限制（大约估计可以支持 30000 多条session数据）
 * 根据文件大小判断使用直接读取还是流式传输
 * 如果文件小于 2M 使用直接读取的 readFile 接口
 * 如果文件大于 2M 使用流式传输的 download 接口
 * @param client
 * @param userId
 * @param endedSessionsFilePath
 * @param logger
 * @returns
 */
export async function readEndedSessionsFile(
  client: ScowdClient,
  userId: string,
  endedSessionsFilePath: string,
  logger: Logger,
): Promise<SessionMetadata[]> {

  const esFileMetadata = await client.file.getFileMetadata({ userId, filePath: endedSessionsFilePath });
  let esContentLines: string[] = [];

  if (Number(esFileMetadata.sizeByte) <= 2 * 1024 * 1024) {
    logger.trace(`EndedSessions files' size is ${Number(esFileMetadata.sizeByte)} B, `
              + "using direct transfer to read the content...");
    const esContent = await client.file.readFile({ userId, filePath: endedSessionsFilePath });
    esContentLines = esContent.content.toString().trim().split("\n");

  } else {
    logger.trace(`EndedSessions files' size is ${Number(esFileMetadata.sizeByte)} B, `
              + "using stream transmission to read the content...");

    let fileContent: Buffer[] = [];
    const abortController = new AbortController();
    try {
      const esReadStream = client.file.download({
        userId, path: endedSessionsFilePath, chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
      }, {
        signal: abortController.signal,
      });
      for await (const response of esReadStream) {
        if (response?.chunk) {
          const chunk = Buffer.from(response.chunk);
          fileContent.push(chunk);
        }
      }
      const esContent = Buffer.concat(fileContent);
      esContentLines = esContent.toString().trim().split("\n");

    } catch (err) {
      logger.error(`Error reading file ${endedSessionsFilePath}:`, err);
      abortController.abort();

      if (err instanceof ConnectError) {
        throw {
          code: mapConnectRpcStatusToGrpc(err.code),
          details: err.message,
        } as ServiceError;
      }
      throw err;
    } finally {
      // 清理内存
      fileContent = [];
    }
  }

  const sessions = parseAndValidateSessionsFileContent(esContentLines, logger);
  return sessions;
}

/**
 * 将 SessionMetadata[]数组转换成要写入的文件内容
 * 每一行增加zod验证，忽略出现错误的行数
 * @param sessionList
 * @param logger
 * @returns
 */
function convertSessionsArrayToFileContent(
  sessionList: SessionMetadata[],
  logger: Logger,
): string {
  return sessionList.map((session) => {
    // 增加 zod 验证
    const validationResult = SessionMetadataSchema.safeParse(session);

    if (validationResult.success) {
      return JSON.stringify(session);
    } else {
      logger.warn("Invalid session data:", validationResult.error);
      return null;
    }
  })
    // 将解析失败的行过滤掉
    .filter((item): item is string => item !== null)
    .join("\n");
}

/**
 * 写入 ended_sessions.json的文件
 * 第一次写入时，默认采用流式传输
 * 之后每次写入新的数据时，添加的原有文件下方
 * @param client
 * @param userId
 * @param endedSessionsFilePath
 * @param existingEndedSessions
 * @param newEndedSessions
 * @param logger
 */
export async function writeEndedSessionsFileContent(
  client: ScowdClient,
  userId: string,
  endedSessionsFilePath: string,
  existingEndedSessions: SessionMetadata[],
  newEndedSessions: SessionMetadata[],
  logger: Logger,
): Promise<void> {

  if (existingEndedSessions.length === 0 && newEndedSessions.length > 0) {
    const writeContent = convertSessionsArrayToFileContent(newEndedSessions, logger);
    const bufferData = Buffer.from(writeContent, "utf8");
    logger.trace(
      "The endedSessions file will be created using streaming transmission during its first initialization.");
    try {
      await client.file.upload((async function* () {
        yield { message: { case: "info", value: { path: endedSessionsFilePath, userId } } };
        yield { message: { case: "chunk", value: new Uint8Array(bufferData) } };
      })());
      logger.trace(`Successfully create endedSessions.json in ${endedSessionsFilePath}`);

      // 指定ended_sessions.json文件权限为 0664
      await client.file.changeMode({ userId, path: endedSessionsFilePath, mode: "0664" });

    } catch (err) {
      logger.error(`Error writing data in ${endedSessionsFilePath}`);
      if (err instanceof ConnectError) {
        throw {
          code: mapConnectRpcStatusToGrpc(err.code),
          details: err.message,
        } as ServiceError;
      }
      throw err;
    }
  }

  // 如果已经有写入的ended_sessions.json文件， 只追加新的 endedSessions
  if (existingEndedSessions.length > 0 && newEndedSessions.length > 0) {
    const newSessionsContent = convertSessionsArrayToFileContent(newEndedSessions, logger);
    const writeContent = "\n" + newSessionsContent;
    await client.file.writeFile({
      userId,
      filePath: endedSessionsFilePath,
      content: writeContent,
      append: true,
    });
    logger.trace(`Added ${newEndedSessions.length} new ended sessions.`);
  }
}
