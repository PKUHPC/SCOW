const getClusterConfigs = jest.fn();
const getStorageMountRefs = jest.fn();
const getActivatedClusters = jest.fn();

jest.mock("@scow/config/build/cluster", () => ({ getClusterConfigs }));
jest.mock("@scow/lib-server", () => ({ getStorageMountRefs }));
jest.mock("src/bl/clustersUtils", () => ({ getActivatedClusters }));
jest.mock("src/config/mis", () => ({ misConfig: { storageOperationTimeoutSeconds: undefined } }));

import { executeStorageOperationWithFailover } from "src/utils/storageExecutionTarget";

const logger = { warn: jest.fn(), error: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getClusterConfigs.mockReturnValue({ active1: {}, active2: {}, deactivated: {} });
  getActivatedClusters.mockResolvedValue({ active1: {}, active2: {} });
  getStorageMountRefs.mockReturnValue([
    {
      clusterId: "active1",
      storageId: "data",
      mountPath: "/disabled/data",
      storage: { quotaEnabled: false },
    },
    {
      clusterId: "deactivated",
      storageId: "data",
      mountPath: "/deactivated/data",
      storage: { quotaEnabled: true },
    },
    {
      clusterId: "active1",
      storageId: "data",
      mountPath: "/active1/data",
      storage: { quotaEnabled: true },
    },
    {
      clusterId: "active2",
      storageId: "data",
      mountPath: "/active2/data",
      storage: { quotaEnabled: true },
    },
  ]);
});

it("retries the next activated mount and never calls a deactivated cluster", async () => {
  const operation = jest.fn(async ({ executionCluster }) => {
    if (executionCluster === "active1") throw new Error("scowd unavailable");
    return "ok";
  });

  const result = await executeStorageOperationWithFailover("data", {} as any, logger as any, operation);

  expect(operation.mock.calls.map(([target]) => target.executionCluster)).toEqual(["active1", "active2"]);
  expect(result.result).toBe("ok");
  expect(result.executionCluster).toBe("active2");
  expect(logger.warn).toHaveBeenCalledTimes(1);
});

it("stops after the first activated mount succeeds", async () => {
  const operation = jest.fn(async (_target: { executionCluster: string }) => "ok");

  const result = await executeStorageOperationWithFailover("data", {} as any, logger as any, operation);

  expect(operation.mock.calls.map(([target]) => target.executionCluster)).toEqual(["active1"]);
  expect(result.result).toBe("ok");
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it("fails before calling scowd when no activated cluster mounts the storage", async () => {
  getActivatedClusters.mockResolvedValue({});
  const operation = jest.fn();

  await expect(executeStorageOperationWithFailover("data", {} as any, logger as any, operation))
    .rejects.toMatchObject({ code: status.FAILED_PRECONDITION });

  expect(operation).not.toHaveBeenCalled();
});

it("fails before calling scowd when quota is disabled on every mount", async () => {
  getStorageMountRefs.mockReturnValue([
    {
      clusterId: "active1",
      storageId: "data",
      mountPath: "/active1/data",
      storage: { quotaEnabled: false },
    },
  ]);
  const operation = jest.fn();

  await expect(executeStorageOperationWithFailover("data", {} as any, logger as any, operation))
    .rejects.toMatchObject({ code: status.NOT_FOUND });

  expect(operation).not.toHaveBeenCalled();
});

it("throws after every activated mount fails", async () => {
  const lastError = new Error("second failed");
  const operation = jest
    .fn()
    .mockRejectedValueOnce(new Error("first failed"))
    .mockRejectedValueOnce(lastError);

  await expect(executeStorageOperationWithFailover("data", {} as any, logger as any, operation)).rejects.toBe(
    lastError,
  );
  expect(operation).toHaveBeenCalledTimes(2);
  expect(logger.warn).toHaveBeenCalledTimes(2);
  expect(logger.error).toHaveBeenCalledWith(
    {
      storageId: "data",
      attemptedCount: 2,
      attemptedClusters: ["active1", "active2"],
      attemptErrors: [
        { cluster: "active1", path: "/active1/data", error: { name: "Error", message: "first failed" } },
        { cluster: "active2", path: "/active2/data", error: { name: "Error", message: "second failed" } },
      ],
    },
    "Storage quota operation failed on all activated mounted clusters",
  );
});

it("uses the default 10s attempt timeout and fails over to the next cluster", async () => {
  jest.useFakeTimers();
  try {
    const operation = jest.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce("ok");

    const resultPromise = executeStorageOperationWithFailover("data", {} as any, logger as any, operation);
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(operation.mock.calls.map(([target]) => target.executionCluster)).toEqual(["active1", "active2"]);
    expect(result.result).toBe("ok");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ storageId: "data", cluster: "active1" }),
      "Storage quota operation failed; trying the next activated mounted cluster",
    );
  } finally {
    jest.useRealTimers();
  }
});

it("gives every cluster the full custom attempt timeout", async () => {
  jest.useFakeTimers();
  try {
    const operation = jest.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}));

    const resultPromise = executeStorageOperationWithFailover(
      "data",
      {} as any,
      logger as any,
      operation,
      { attemptTimeoutMs: 1_000 },
    );
    // 立即挂接 rejection handler，避免第二次尝试超时时 Jest 将其视为未处理 rejection。
    const resultError = resultPromise.catch((error) => error);

    await jest.advanceTimersByTimeAsync(1_000);
    // 第一个集群超时后，故障转移通过 Promise continuation 启动第二个请求。
    // 先排空微任务，确保第二个请求的超时计时器已经注册，再推进第二个尝试。
    await Promise.resolve();
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(999);
    expect(logger.error).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(resultError).resolves.toMatchObject({
      code: status.DEADLINE_EXCEEDED,
      message: expect.stringContaining("active2"),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        storageId: "data",
        attemptedCount: 2,
        attemptedClusters: ["active1", "active2"],
      }),
      "Storage quota operation failed on all activated mounted clusters",
    );
  } finally {
    jest.useRealTimers();
  }
});

it("uses the configured default timeout when storageOperationTimeoutSeconds is omitted", async () => {
  jest.useFakeTimers();
  try {
    const operation = jest.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce("ok");
    const resultPromise = executeStorageOperationWithFailover("data", {} as any, logger as any, operation);
    await jest.advanceTimersByTimeAsync(9_999);
    expect(operation).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toMatchObject({ result: "ok", executionCluster: "active2" });
  } finally {
    jest.useRealTimers();
  }
});

it("fails over when one request in a Promise.all operation fails and uses the next target", async () => {
  const seenTargets: { cluster: string; path: string; storage: unknown }[] = [];
  const operation = jest.fn(async (target) => {
    seenTargets.push({ cluster: target.executionCluster, path: target.executionPath, storage: target.executionStorage });
    const [quota, usage] = await Promise.all([
      Promise.resolve(target.executionCluster === "active1" ? Promise.reject(new Error("quota failed")) : { ok: true }),
      Promise.resolve({ totalStorageMb: 100 }),
    ]);
    return { quota, usage };
  });

  const result = await executeStorageOperationWithFailover("data", {} as any, logger as any, operation);

  expect(result.executionCluster).toBe("active2");
  expect(seenTargets).toHaveLength(2);
  expect(seenTargets[1]).toMatchObject({ cluster: "active2", path: "/active2/data" });
  expect(seenTargets[1].storage).toEqual(expect.objectContaining({ storageId: "data" }));
});
import { status } from "@grpc/grpc-js";
