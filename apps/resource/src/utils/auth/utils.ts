import { TRPCError } from "@trpc/server";
import { PlatformRole, TenantRole } from "src/models/user";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Logger } from "ts-log";

export const applicationJsonHeaders = { "content-type": "application/json" };

export class HttpError extends Error {
  constructor(public resp: Response) {
    super("Error occurred when calling auth HTTP API");
  }

  get status() {
    return this.resp.status;
  }
}

export const logHttpErrorAndThrow = (resp: Response, logger?: Logger) => {
  logger?.error("HTTP Error when calling auth HTTP API. Status code %s", resp.status);

  throw new HttpError(resp);
};

export class UserForbiddenError extends TRPCError {
  constructor(userId: string) {
    super({
      code: "FORBIDDEN",
      message: `User: ${userId} is forbidden to access the page`,
    });
  }
}


export class NoAvailableClustersError extends TRPCError {
  constructor() {
    super({
      code: "NOT_FOUND",
      message: "There is no available clusters",
    });
  }
}

export class AccountUserSyncRunningError extends TRPCError {
  constructor() {
    super({
      code: "CONFLICT",
      message: "There is a account user synchronization task is running. "
      + "Please perform the authorization or deauthorization operation after the synchronization is completed.",
    });
  }
}

export function isResourceAdmin(user: ClientUserInfo): boolean {
  return user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) 
      || user.tenantRoles.includes(TenantRole.TENANT_ADMIN);
}

