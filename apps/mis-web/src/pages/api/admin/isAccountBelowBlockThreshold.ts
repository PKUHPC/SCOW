import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AccountServiceClient, IsAccountBelowBlockThresholdRequest } from "@scow/protos/build/server/account";
import { Static,Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// 定义返回的 schema
export const AccountThresholdSchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    accountName: Type.String(), // 接收 accountName 参数
  }),
  responses: {
    200: Type.Object({
      isBelowBlockThreshold: Type.Boolean(), // 返回是否低于区块阈值
    }),
  },
});

// 定义类型
export type AccountThresholdResponse = Static<typeof AccountThresholdSchema.responses[200]>;

// 调用 gRPC 服务来获取账户状态
export async function checkAccountBelowThreshold(accountName: string): Promise<AccountThresholdResponse> {
  const client = getClient(AccountServiceClient);
  const request: IsAccountBelowBlockThresholdRequest = {
    accountName,
  };

  // 调用 gRPC 方法
  const response = await asyncClientCall(client, "isAccountBelowBlockThreshold", request);

  // 通过 gRPC 响应判断是否低于区块阈值
  const isBelowBlockThreshold = response.isBelowBlockThreshold;
  return { isBelowBlockThreshold };
}


// 定义路由处理函数
export default route(AccountThresholdSchema, async (req) => {
  const { accountName } = req.query;

  try {
    // 调用 checkAccountBelowThreshold 方法获取账户状态
    const result = await checkAccountBelowThreshold(accountName);
    return { 200: result };
  } catch (error) {
    // 错误处理
    if ((error as ServiceError).code === Status.NOT_FOUND) {
      //  Not Found 错误
      throw new Error(`Account with name ${accountName} not found.`);
    } else if ((error as ServiceError).code === Status.FAILED_PRECONDITION) {
      // Precondition Failed 错误
      throw new Error(`Account ${accountName} is not in a valid state to check the threshold.`);
    } else {
      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }
});
