import type { FastifyReply, FastifyRequest } from "fastify";

export type ValidationResult = string | undefined;

export interface CreateUserInfo {
  mail: string;
  id: number;
  identityId: string;
  name: string;
  password: string;
}

export type ValidateNameResult = "NotFound" | "Match" | "NotMatch";
export type CreateUserResult = "AlreadyExists" | "OK";
export type ChangePasswordResult = "NotFound" | "OK";
export type CheckPasswordResult = "NotFound" | "Match" | "NotMatch";
export type ChangeEmailResult = "NotFound" | "OK";
export type DeleteUserResult = "NotFound" | "OK" | "Failed";
export type UnlockUserResult = "NotFound" | "OK" | "Failed";
export type ModifyForcedResult = "NotFound" | "OK";

export interface UserInfo {
  identityId: string;
  name?: string;
  mail?: string;
  blocked: boolean;
}

export interface AuthProvider {
  serveLoginHtml: (callbackUrl: string, req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  fetchAuthTokenInfo: (token: string, req: FastifyRequest) => Promise<string | undefined>;
  getUser: undefined | ((identityId: string, req: FastifyRequest) => Promise<UserInfo | undefined>);
  getLockedUsers:
    | undefined
    | ((params: { identityId?: string; name?: string }, req: FastifyRequest) => Promise<UserInfo[] | undefined>);
  createUser: undefined | ((info: CreateUserInfo, req: FastifyRequest) => Promise<CreateUserResult>);
  changePassword: undefined | ((id: string, newPassword: string, req: FastifyRequest) => Promise<ChangePasswordResult>);
  checkPassword:
    | undefined
    | ((identityId: string, password: string, req: FastifyRequest) => Promise<CheckPasswordResult>);
  changeEmail: undefined | ((id: string, newEmail: string, req: FastifyRequest) => Promise<ChangeEmailResult>);
  deleteUser: undefined | ((identityId: string, req: FastifyRequest) => Promise<DeleteUserResult>);
  unlockUser: undefined | ((id: string, req: FastifyRequest) => Promise<UnlockUserResult>);
  updatePasswordResetFlag:
    | undefined
    | ((id: string, forceFlag: boolean, req: FastifyRequest) => Promise<ModifyForcedResult>);
}
