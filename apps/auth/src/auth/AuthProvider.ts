/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

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
}



export interface AuthProvider {
  serveLoginHtml: (callbackUrl: string, req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  fetchAuthTokenInfo: (token: string, req: FastifyRequest) => Promise<string | undefined>;
  getUser: undefined | ((identityId: string, req: FastifyRequest) => Promise<UserInfo | undefined>);
  getLockedUsers: undefined | ((identityId: string | undefined, req: FastifyRequest)
  => Promise<UserInfo[] | undefined>);
  createUser: undefined | ((info: CreateUserInfo, req: FastifyRequest) => Promise<CreateUserResult>);
  changePassword: undefined | ((id: string, newPassword: string, req: FastifyRequest) => Promise<ChangePasswordResult>);
  checkPassword: undefined | ((identityId: string, password: string, req: FastifyRequest)
  => Promise<CheckPasswordResult>);
  changeEmail: undefined | ((id: string, newEmail: string,
    req: FastifyRequest) => Promise<ChangeEmailResult>);
  deleteUser: undefined | ((identityId: string, req: FastifyRequest) => Promise<DeleteUserResult>);
  unlockUser: undefined | ((id: string, req: FastifyRequest) => Promise<UnlockUserResult>);
  updatePasswordResetFlag: undefined | ((id: string, forceFlag: boolean , req: FastifyRequest)
  => Promise<ModifyForcedResult>);
}
