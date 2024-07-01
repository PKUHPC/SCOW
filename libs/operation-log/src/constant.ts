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

import { OperationLog } from "@scow/protos/build/audit/operation_log";
export enum OperationResult {
  UNKNOWN = 0,
  SUCCESS = 1,
  FAIL = 2,
};

type ExtractCases<T> = T extends { $case: infer U } ? U : never;

export type OperationType = ExtractCases<OperationLog["operationEvent"]>;

export type OperationTypeEnum = { [K in OperationType]: K };

export const OperationType: OperationTypeEnum = {
  login: "login",
  logout: "logout",
  submitJob: "submitJob",
  endJob: "endJob",
  addJobTemplate: "addJobTemplate",
  deleteJobTemplate: "deleteJobTemplate",
  updateJobTemplate: "updateJobTemplate",
  shellLogin: "shellLogin",
  createDesktop: "createDesktop",
  deleteDesktop: "deleteDesktop",
  createApp: "createApp",
  createFile: "createFile",
  deleteFile: "deleteFile",
  uploadFile: "uploadFile",
  createDirectory: "createDirectory",
  deleteDirectory: "deleteDirectory",
  moveFileItem: "moveFileItem",
  copyFileItem: "copyFileItem",
  setJobTimeLimit: "setJobTimeLimit",
  createUser: "createUser",
  addUserToAccount: "addUserToAccount",
  removeUserFromAccount: "removeUserFromAccount",
  setAccountAdmin: "setAccountAdmin",
  unsetAccountAdmin: "unsetAccountAdmin",
  blockUser: "blockUser",
  unblockUser: "unblockUser",
  accountSetChargeLimit: "accountSetChargeLimit",
  accountUnsetChargeLimit: "accountUnsetChargeLimit",
  setTenantBilling: "setTenantBilling",
  setTenantAdmin: "setTenantAdmin",
  unsetTenantAdmin: "unsetTenantAdmin",
  setTenantFinance: "setTenantFinance",
  unsetTenantFinance: "unsetTenantFinance",
  tenantChangePassword: "tenantChangePassword",
  createAccount: "createAccount",
  addAccountToWhitelist: "addAccountToWhitelist",
  removeAccountFromWhitelist: "removeAccountFromWhitelist",
  accountPay: "accountPay",
  blockAccount: "blockAccount",
  unblockAccount: "unblockAccount",
  importUsers: "importUsers",
  setPlatformAdmin: "setPlatformAdmin",
  unsetPlatformAdmin: "unsetPlatformAdmin",
  setPlatformFinance: "setPlatformFinance",
  unsetPlatformFinance: "unsetPlatformFinance",
  platformChangePassword: "platformChangePassword",
  setPlatformBilling: "setPlatformBilling",
  createTenant: "createTenant",
  tenantPay: "tenantPay",
  submitFileItemAsJob: "submitFileItemAsJob",
  exportUser: "exportUser",
  exportAccount: "exportAccount",
  exportChargeRecord: "exportChargeRecord",
  exportPayRecord: "exportPayRecord",
  exportOperationLog: "exportOperationLog",
  setAccountBlockThreshold: "setAccountBlockThreshold",
  setAccountDefaultBlockThreshold: "setAccountDefaultBlockThreshold",
  userChangeTenant: "userChangeTenant",
  customEvent: "customEvent",
  activateCluster:"activateCluster",
  deactivateCluster:"deactivateCluster",
  createImage:"createImage",
  updateImage:"updateImage",
  shareImage:"shareImage",
  deleteImage:"deleteImage",
  copyImage:"copyImage",
  createDataset:"createDataset",
  updateDataset:"updateDataset",
  deleteDataset:"deleteDataset",
  createDatasetVersion:"createDatasetVersion",
  updateDatasetVersion:"updateDatasetVersion",
  shareDatasetVersion:"shareDatasetVersion",
  deleteDatasetVersion:"deleteDatasetVersion",
  copyDatasetVersion:"copyDatasetVersion",
  createAiTrain:"createAiTrain",
  cancelAiTrainOrApp:"cancelAiTrainOrApp",
  saveImage :"saveImage",

};
