import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Decimal, moneyToNumber } from "@scow/lib-decimal";
import { libCheckUserAccountPermission } from "@scow/lib-server";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Account_DisplayedAccountState as DisplayedAccountState } from "@scow/protos/build/server/account";
import { Account_AccountState } from "@scow/protos/build/server/account";
import { TRPCError } from "@trpc/server";
import { allowedChipsArr, allowedQosValues } from "src/models/device";
import { EstimateTaskSchema, TaskEstimateArray } from "src/models/task";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { quantumConfig } from "src/server/config/quantum";
import { callBackendApi } from "src/server/trpc/route/backend/common";
import { logger } from "src/server/utils/logger";
import { getMisClient } from "src/utils/client";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

export async function mock<T>(actualFn: () => T, mockFn: () => T) {
  if (USE_MOCK) {
    return mockFn();
  } else {
    return actualFn();
  }
}

export const pagination = z.object({
  page: z.number(),
  pageSize: z.number().default(10),
});

export function clusterExist(clusterId: string, currentClusterIds: string[]) {
  return !!currentClusterIds.includes(clusterId);
}

export const booleanQueryParam = () =>
  z.union([z.literal("true"), z.literal("false")]).transform((arg) => arg === "true");

export enum ErrorCode {
  ALGORITHM_NAME_ALREADY_EXIST = "algorithm_name_already_exist",
  OLD_PASSWORD_IS_WRONG = "old_password_is_wrong",
  FILE_NOT_EXSIT = "file_not_exist",
  FILE_EXSIT = "file_exist",
  FILE_CANNOT_BE_ACCESSED = "file_cannot_be_accessed",
  FILE_NOT_READABLE = "file_not_readable",
  FILE_NOT_WRITABLE = "file_not_writable",
}

export function checkDeviceAvailability(device: string) {
  const querySeparatorIndex = device.indexOf("?");
  let deviceId: string;
  if (querySeparatorIndex !== -1) {
    // 如果存在 '?'，则拆分设备 ID 和查询字符串
    deviceId = device.substring(0, querySeparatorIndex);
    const queryString = device.substring(querySeparatorIndex + 1);

    const params = new URLSearchParams(queryString);
    const oParam = params.get("o");

    if (params.size > 1 || oParam === null) {
      throw new Error("Only parameter 'o' is allowed. The 'o' parameter must be an integer between 0 and 7.");
    }

    if (!allowedQosValues.includes(oParam)) {
      throw new Error(`Unknown QoS value: '${oParam}' . The 'o' parameter must be an integer between 0 and 7.`);
    }
  } else {
    // 如果不存在 '?'，整个字符串就是设备 ID
    deviceId = device;
  }

  if (!(allowedChipsArr as unknown as string[]).includes(deviceId)) {
    throw new Error(`device with name ${device} not found`);
  }
}

export enum AccountStatusFilter {
  ALL = 0,
  BLOCKED_ONLY = 1,
  UNBLOCKED_ONLY = 2,
}

export async function checkUserAccountPermission(userId: string, accountName: string) {
  if (USE_MOCK || accountName === "_") {
    return true;
  }
  return await libCheckUserAccountPermission(
    logger,
    userId,
    accountName,
    AccountStatusFilter.UNBLOCKED_ONLY,
    config.MIS_SERVER_URL,
    commonConfig.scowApi.auth.token,
  );
}

export interface AccountInfo {
  tenantName: string;
  isInWhitelist: boolean;
  displayedState: DisplayedAccountState;
  balance: Decimal;
  state: Account_AccountState;
  thresholdAmount: Decimal;
}

export async function getAccountInfo(accountName: string): Promise<AccountInfo> {
  if (USE_MOCK) {
    return {
      tenantName: "default",
      isInWhitelist: true,
      displayedState: DisplayedAccountState.DISPLAYED_NORMAL,
      balance: new Decimal(100),
      state: Account_AccountState.NORMAL,
      thresholdAmount: new Decimal(0),
    };
  }

  const client = getMisClient(AccountServiceClient);

  const { results } = await asyncClientCall(client, "getAccounts", {
    accountName: accountName,
  });

  if (results.length === 0) {
    throw new Error(`Account '${accountName}' not found.`);
  }

  if (results.length > 1) {
    throw new Error(`Multiple accounts found for '${accountName}'. Expected one.`);
  }

  const {
    tenantName,
    isInWhitelist,
    displayedState,
    balance,
    state,
    blockThresholdAmount,
    defaultBlockThresholdAmount,
  } = results[0];

  const balanceAmount = new Decimal(moneyToNumber(balance!));

  const thresholdAmount = new Decimal(moneyToNumber(blockThresholdAmount ?? defaultBlockThresholdAmount!));

  return {
    tenantName,
    isInWhitelist: isInWhitelist ? true : false,
    displayedState,
    balance: balanceAmount,
    state,
    thresholdAmount,
  };
}

export const getAccountState = (
  isInWhitelist: boolean,
  state: Account_AccountState,
  balance: Decimal,
  thresholdAmount: Decimal,
): DisplayedAccountState => {
  if (state === Account_AccountState.DELETED) {
    return DisplayedAccountState.DISPLAYED_DELETED;
  }

  if (state === Account_AccountState.FROZEN) {
    return DisplayedAccountState.DISPLAYED_FROZEN;
  }

  if (isInWhitelist) {
    return DisplayedAccountState.DISPLAYED_NORMAL;
  }

  if (state === Account_AccountState.BLOCKED_BY_ADMIN) {
    return DisplayedAccountState.DISPLAYED_BLOCKED;
  }

  return balance.lte(thresholdAmount)
    ? DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD
    : DisplayedAccountState.DISPLAYED_NORMAL;
};

export const estimateAccountCanAfford = async (
  accountInfo: AccountInfo,
  tasks: TaskEstimateArray,
): Promise<boolean> => {
  if (USE_MOCK) {
    return true;
  }

  // 用于存储为 estimate 接口准备的任务列表
  const estimateTasks = [] as {
    qubits: number;
    shots: number;
    device: string;
  }[];

  for (const taskInfo of tasks) {
    const qasmSource = taskInfo.source;
    const match = /qreg\s+\w+\[(\d+)\];/.exec(qasmSource);

    let numQubits = 0;
    if (match?.[1]) {
      numQubits = parseInt(match[1], 10);
    }

    const taskForEstimate = {
      qubits: numQubits,
      shots: taskInfo.shots,
      device: taskInfo.device,
    };

    estimateTasks.push(taskForEstimate);
  }

  const estimatePayload = {
    tasks: estimateTasks,
  };

  const estimateResp = await callBackendApi("/task/estimate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(estimatePayload),
  });

  const estimateData = EstimateTaskSchema.safeParse(estimateResp);

  if (!estimateData.success) {
    logger.error("Invalid estimate response for task:", estimateData.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Invalid estimate response for task",
    });
  }

  const qits = new Decimal(estimateData.data.qits);

  const amount = qits.times("0.000001").times(quantumConfig.billing.defaultBitSecondPrice);

  const newBalance = accountInfo.balance.minus(amount);

  const accountState = getAccountState(
    accountInfo.isInWhitelist,
    accountInfo.state,
    newBalance,
    accountInfo.thresholdAmount,
  );

  return accountState === DisplayedAccountState.DISPLAYED_NORMAL;
};
