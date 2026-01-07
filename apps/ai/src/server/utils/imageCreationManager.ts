import { Logger } from "ts-log";

import { ImageCreationLogRes } from "../trpc/route/image/image";

export enum CreationOperation {
  UNKNOWN = "UNKNOWN",
  LOAD_IMAGE = "LOAD_IMAGE",
  PULL_IMAGE = "PULL_IMAGE",
  COMMIT_IMAGE = "COMMIT_IMAGE",
  PUSH_IMAGE = "PUSH_IMAGE",
}
export const LOAD_DEFAULT_OUTPUT = "loading local image ...";
export const COMMIT_DEFAULT_OUTPUT = "committing image ...";
export const DEFAULT_OUTPUT = "creating image ...";

export type CompletedLogs = Map<CreationOperation, string | undefined>;

export interface OperationLog {
  operationName: CreationOperation;
  operationLog: string;
  currentLogLength: number;
  isCompleted?: boolean;
  createTime: Date;
  updateTime: Date;
}

export interface ImageCreationOperation {
  imageId: number;
  currentOperation: CreationOperation;
  operationLogs: Map<CreationOperation, OperationLog>;
  isCreated?: boolean;
  createTime: Date;
  updateTime: Date;
}

export const imageOperationsStore = new Map<number, ImageCreationOperation>();

/**
 *
 * @param imageId
 * @param outputChunk
 * @param operationName
 * @returns
 */
export function appendImageCreationOutput(
  imageId: number,
  operationName: CreationOperation,
  outputChunk: string,
  logger: Logger,
  isOperationCompleted?: boolean,
  isCreated?: boolean,
) {

  const op = imageOperationsStore.get(imageId);
  const currentLogBuffer = outputChunk ? Buffer.from(outputChunk, "utf-8") : Buffer.alloc(0);
  const currentTotalLength = currentLogBuffer.length;
  const now = new Date();

  // 没有任何操作记录时写入新的记录
  if (!op) {
    const operationLog: OperationLog = {
      operationName,
      operationLog: outputChunk,
      currentLogLength: currentTotalLength,
      isCompleted: isOperationCompleted,
      createTime: now,
      updateTime: now,
    };
    const operationLogs = new Map<CreationOperation, OperationLog>();
    operationLogs.set(operationName, operationLog);
    const imageOp: ImageCreationOperation = {
      imageId,
      currentOperation: operationName,
      operationLogs,
      isCreated: isCreated || false,
      createTime: now,
      updateTime: now,
    };
    imageOperationsStore.set(imageId, imageOp);
    return;

  // 有操作记录时判断新写入当前操作类型的日志
  // 还是续写已有日志
  } else {
    const currentOperationLog = op.operationLogs.get(operationName);

    // 如果当前传递类型日志不存在
    if (!currentOperationLog) {
      // （1）确保其他日志已结束
      op.operationLogs.forEach((log, operationName) => {
        if (!log.isCompleted) {
          logger.trace(`Mark operation ${operationName} as Completed of image ${imageId}`);
          log.isCompleted = true;
          log.updateTime = new Date();
        }
      });
      // （2）创建新的日志
      const newOperationLog: OperationLog = {
        operationName,
        operationLog: outputChunk,
        currentLogLength: currentTotalLength,
        isCompleted: isOperationCompleted,
        createTime: now,
        updateTime: now,
      };
      op.operationLogs.set(operationName, newOperationLog);

    // 如果操作类型对应日志已经存在则续写日志
    } else {

      if (operationName === CreationOperation.PULL_IMAGE || operationName === CreationOperation.PUSH_IMAGE) {
        currentOperationLog.operationLog += outputChunk;
        currentOperationLog.currentLogLength += currentTotalLength;
      } else {
        logger.trace(`Append Operation ${operationName} log message of Image ${imageId}. Just use the same message.`);
        currentOperationLog.operationLog = outputChunk;
        currentOperationLog.currentLogLength = currentTotalLength;
      }
      currentOperationLog.updateTime = now;
      currentOperationLog.isCompleted = isOperationCompleted || false;
    }

    // 更新
    op.currentOperation = operationName;
    op.updateTime = now;
    op.isCreated = isCreated || false;

  }
}

export function cleanupImageCreationOutput(
  imageId: number, logger: Logger, delay: number = 3 * 60 * 1000,
) {
  // 3分钟后清除，给前端足够时间获取数据
  setTimeout(() => {
    logger.trace("The image creation log will be cleanup after 3 minutes for front-end display.");
    imageOperationsStore.delete(imageId);
  }, delay);
};

/**
 * API模拟分页流
 * @param imageId
 * @param skip 本次查询skip
 * @param limit 本次查询大小
 * @param logger
 * @param lastQueriedOperation 上一次查询的状态
 * @returns
 * 返回当前的处理名称，此次查询的log日志，
 * 此次查询的最终长度，当前处理是否结束，上传镜像（代表创建镜像总流程）是否结束
 */
export function getCurrentImageCreationLog(
  imageId: number,
  skip: number,
  limit: number,
  logger: Logger,
  lastQueriedOperation?: CreationOperation,
): ImageCreationLogRes {
  const operation = imageOperationsStore.get(imageId);
  if (!operation) return { currentOperation: CreationOperation.UNKNOWN, totalResChunkSizeForCurrentOperation: 0 };

  const currentOpType = operation.currentOperation;
  const opDetail = operation.operationLogs.get(currentOpType);
  const chunk = opDetail?.operationLog;
  const totalLength = chunk ? Buffer.from(chunk, "utf-8").length : 0;

  // (1). 操作切换判定
  const isOpSwitched = lastQueriedOperation && lastQueriedOperation !== currentOpType;

  if (isOpSwitched) {
    // 只要操作换了，强制从 0 开始返回新操作的日志
    const { logChunk, endIndex } = getLogSlice(chunk, 0, limit);
    return {
      currentOperation: currentOpType,
      logChunk,
      totalResChunkSizeForCurrentOperation: endIndex,
      isCompleted: opDetail?.isCompleted || false,
      isPushedCompleted: operation.isCreated || false,
    };
  }

  // (2). 第一次查询
  if (!lastQueriedOperation && skip === 0) {
    return {
      currentOperation: currentOpType,
      logChunk: chunk,
      totalResChunkSizeForCurrentOperation: totalLength,
      isCompleted: opDetail?.isCompleted || false,
      isPushedCompleted: operation.isCreated || false,
    };
  }

  // (3) 同一操作的增量查询
  // 无论 lastQueriedCompleted 上一次查询是否结束，只要前端还来请求，就看有没有新数据
  const { logChunk, endIndex } = getLogSlice(chunk, skip, limit);

  return {
    currentOperation: currentOpType,
    logChunk,
    totalResChunkSizeForCurrentOperation: endIndex,
    isCompleted: opDetail?.isCompleted || false,
    isPushedCompleted: operation.isCreated || false,
  };
}

function getLogSlice(currentLog: string | undefined, skip: number, limit: number) {
  const buf = currentLog ? Buffer.from(currentLog, "utf-8") : Buffer.alloc(0);
  const start = Math.min(skip, buf.length);
  const end = Math.min(start + limit, buf.length);
  return {
    logChunk: buf.subarray(start, end).toString("utf-8"),
    // 准确定位到最后
    endIndex: end,
  };
}

// 数据库对于错误信息字段没有特别强调大小，MySql默认TEXT为64KB
// Pull的日志会累积进度流很容易溢出，所以对错误信息进行截断
// 最多保留16KB错误信息
export function truncateErrorMessage(errorMessage: string, maxLength: number = 16 * 1024): string {
  if (!errorMessage || errorMessage.length <= maxLength) {
    return errorMessage;
  }

  const ellipsis = "...[earlier content truncated]...\n";
  const availableLength = maxLength - ellipsis.length;

  // 如果错误信息本身就很长，直接截取末尾部分
  if (availableLength <= 0) {
    return ellipsis + errorMessage.slice(-maxLength);
  }

  const lines = errorMessage.split("\n");
  let result = "";
  let currentLength = 0;

  // 从后往前添加完整的行
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] + (i > 0 ? "\n" : "");
    if (currentLength + line.length > availableLength) {
      break;
    }
    result = line + result;
    currentLength += line.length;
  }

  return ellipsis + result;
}


