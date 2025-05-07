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

import { TRPCError } from "@trpc/server";

export const clusterNotFound = (cluster: string) => {
  return { code: "NOT_FOUND", message: `cluster ${cluster} is not found` } as TRPCError;
};

export const loginNodeNotFound = (loginNode: string) => {
  return { code: "NOT_FOUND", message: `login node ${loginNode} is not found` } as TRPCError;
};

export const scowdClientNotFound = (cluster: string) => {
  return {
    code: "NOT_FOUND",
    message: `The scowd client on cluster ${cluster} was not found`,
  } as TRPCError;
};
