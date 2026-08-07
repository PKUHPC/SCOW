import { OperationEvent, OperationType as LibOperationType } from "@scow/lib-operation-log";
import {
  ExportBill,
  ExportChargeRecord,
  ExportJobRecord,
  ExportOperationLog,
  ExportPayRecord,
  ExportUserBill,
} from "@scow/protos/build/audit/operation_log";
import { Static, Type } from "@sinclair/typebox";
import { ValueOf } from "next/dist/shared/lib/constants";
import React from "react";
import { Lang } from "react-typed-i18n";
import UserIdsDisplay from "src/components/UserIdsDisplay";
import { getI18nCurrentText, prefix } from "src/i18n";
import en from "src/i18n/en";
import { getClusterName, getClusterNameWithUndefined } from "src/utils/cluster";
import { Cluster } from "src/utils/cluster";
import { safeGetStringProperty } from "src/utils/format";
import { moneyToString, nullableMoneyToString } from "src/utils/money";

export const OperationResult = {
  UNKNOWN: 0,
  SUCCESS: 1,
  FAIL: 2,
} as const;

export type OperationResult = ValueOf<typeof OperationResult>;

export const OperationLog = Type.Object({
  operationLogId: Type.Number(),
  operatorUserId: Type.String(),
  operatorUserName: Type.String(),
  operatorIp: Type.String(),
  operationResult: Type.Enum(OperationResult),
  operationTime: Type.Optional(Type.String()),
  operationEvent: Type.Any(),
  customEventType: Type.Optional(Type.String()),
});
export type OperationLog = Static<typeof OperationLog>;

export enum OperationLogQueryType {
  USER = 0,
  // ACCOUNT前端相关逻辑已删除
  ACCOUNT = 1,
  TENANT = 2,
  PLATFORM = 3,
}

export const OperationSortBy = Type.Union([
  Type.Literal("id"),
  Type.Literal("operationResult"),
  Type.Literal("operationTime"),
  Type.Literal("operatorIp"),
  Type.Literal("operatorUserId"),
]);
export type OperationSortBy = Static<typeof OperationSortBy>;

export const OperationSortOrder = Type.Union([Type.Literal("descend"), Type.Literal("ascend")]);
export type OperationSortOrder = Static<typeof OperationSortOrder>;

type OperationTextsTransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;
const pRes = prefix("operationLog.resultTexts.");
const pTypes = prefix("operationLog.operationTypeTexts.");
const pDetails = prefix("operationLog.operationDetails.");

export const getOperationResultTexts = (t: OperationTextsTransType) => {
  return {
    [OperationResult.UNKNOWN]: t(pRes("unknown")),
    [OperationResult.SUCCESS]: t(pRes("success")),
    [OperationResult.FAIL]: t(pRes("fail")),
  };
};

export const getOperationTypeTexts = (t: OperationTextsTransType): { [key in LibOperationType]: string } => {
  return {
    login: t(pTypes("login")),
    logout: t(pTypes("logout")),
    submitJob: t(pTypes("submitJob")),
    endJob: t(pTypes("endJob")),
    addJobTemplate: t(pTypes("addJobTemplate")),
    deleteJobTemplate: t(pTypes("deleteJobTemplate")),
    updateJobTemplate: t(pTypes("updateJobTemplate")),
    shellLogin: t(pTypes("shellLogin")),
    createDesktop: t(pTypes("createDesktop")),
    deleteDesktop: t(pTypes("deleteDesktop")),
    createApp: t(pTypes("createApp")),
    createAiTrain: t(pTypes("createAiTrain")),
    createDevHost: t(pTypes("createDevHost")),
    cancelAiTrainOrApp: t(pTypes("cancelAiTrainOrApp")),
    saveImage: t(pTypes("saveImage")),
    createFile: t(pTypes("createFile")),
    deleteFile: t(pTypes("deleteFile")),
    uploadFile: t(pTypes("uploadFile")),
    createDirectory: t(pTypes("createDirectory")),
    deleteDirectory: t(pTypes("deleteDirectory")),
    moveFileItem: t(pTypes("moveFileItem")),
    copyFileItem: t(pTypes("copyFileItem")),
    compressFiles: t(pTypes("compressFiles")),
    setJobTimeLimit: t(pTypes("setJobTimeLimit")),
    createImage: t(pTypes("createImage")),
    updateImage: t(pTypes("updateImage")),
    shareImage: t(pTypes("shareImage")),
    deleteImage: t(pTypes("deleteImage")),
    copyImage: t(pTypes("copyImage")),
    createDataset: t(pTypes("createDataset")),
    updateDataset: t(pTypes("updateDataset")),
    deleteDataset: t(pTypes("deleteDataset")),
    createDatasetVersion: t(pTypes("createDatasetVersion")),
    updateDatasetVersion: t(pTypes("updateDatasetVersion")),
    shareDatasetVersion: t(pTypes("shareDatasetVersion")),
    copyDatasetVersion: t(pTypes("copyDatasetVersion")),
    deleteDatasetVersion: t(pTypes("deleteDatasetVersion")),
    createAlgorithm: t(pTypes("createAlgorithm")),
    updateAlgorithm: t(pTypes("updateAlgorithm")),
    deleteAlgorithm: t(pTypes("deleteAlgorithm")),
    createAlgorithmVersion: t(pTypes("createAlgorithmVersion")),
    updateAlgorithmVersion: t(pTypes("updateAlgorithmVersion")),
    shareAlgorithmVersion: t(pTypes("shareAlgorithmVersion")),
    deleteAlgorithmVersion: t(pTypes("deleteAlgorithmVersion")),
    copyAlgorithmVersion: t(pTypes("copyAlgorithmVersion")),
    createModel: t(pTypes("createModel")),
    updateModel: t(pTypes("updateModel")),
    deleteModel: t(pTypes("deleteModel")),
    createModelVersion: t(pTypes("createModelVersion")),
    updateModelVersion: t(pTypes("updateModelVersion")),
    shareModelVersion: t(pTypes("shareModelVersion")),
    deleteModelVersion: t(pTypes("deleteModelVersion")),
    copyModelVersion: t(pTypes("copyModelVersion")),
    createUser: t(pTypes("createUser")),
    addUserToAccount: t(pTypes("addUserToAccount")),
    removeUserFromAccount: t(pTypes("removeUserFromAccount")),
    setAccountAdmin: t(pTypes("setAccountAdmin")),
    unsetAccountAdmin: t(pTypes("unsetAccountAdmin")),
    blockUser: t(pTypes("blockUser")),
    unblockUser: t(pTypes("unblockUser")),
    accountSetChargeLimit: t(pTypes("accountSetChargeLimit")),
    accountUnsetChargeLimit: t(pTypes("accountUnsetChargeLimit")),
    setTenantBilling: t(pTypes("setTenantBilling")),
    setTenantAdmin: t(pTypes("setTenantAdmin")),
    unsetTenantAdmin: t(pTypes("unsetTenantAdmin")),
    setTenantFinance: t(pTypes("setTenantFinance")),
    unsetTenantFinance: t(pTypes("unsetTenantFinance")),
    tenantChangePassword: t(pTypes("tenantChangePassword")),
    deleteUser: t(pTypes("deleteUser")),
    createAccount: t(pTypes("createAccount")),
    deleteAccount: t(pTypes("deleteAccount")),
    addAccountToWhitelist: t(pTypes("addAccountToWhitelist")),
    removeAccountFromWhitelist: t(pTypes("removeAccountFromWhitelist")),
    accountPay: t(pTypes("accountPay")),
    blockAccount: t(pTypes("blockAccount")),
    unblockAccount: t(pTypes("unblockAccount")),
    importUsers: t(pTypes("importUsers")),
    setPlatformAdmin: t(pTypes("setPlatformAdmin")),
    unsetPlatformAdmin: t(pTypes("unsetPlatformAdmin")),
    setPlatformFinance: t(pTypes("setPlatformFinance")),
    unsetPlatformFinance: t(pTypes("unsetPlatformFinance")),
    platformChangePassword: t(pTypes("platformChangePassword")),
    setPlatformBilling: t(pTypes("setPlatformBilling")),
    createTenant: t(pTypes("createTenant")),
    tenantPay: t(pTypes("tenantPay")),
    submitFileItemAsJob: t(pTypes("submitFileItemAsJob")),
    exportUser: t(pTypes("exportUser")),
    exportAccount: t(pTypes("exportAccount")),
    exportChargeRecord: t(pTypes("exportChargeRecord")),
    exportPayRecord: t(pTypes("exportPayRecord")),
    exportOperationLog: t(pTypes("exportOperationLog")),
    exportJobRecord: t(pTypes("exportJobRecord")),
    exportBill: t(pTypes("exportBill")),
    exportUserBill: t(pTypes("exportUserBill")),
    setAccountBlockThreshold: t(pTypes("setAccountBlockThreshold")),
    setAccountDefaultBlockThreshold: t(pTypes("setAccountDefaultBlockThreshold")),
    userChangeTenant: t(pTypes("userChangeTenant")),
    activateCluster: t(pTypes("activateCluster")),
    deactivateCluster: t(pTypes("deactivateCluster")),
    customEvent: t(pTypes("customEvent")),
    mergeFileChunks: t(pTypes("mergeFileChunks")),
    initMultipartUpload: t(pTypes("initMultipartUpload")),
    markMessageRead: t(pTypes("markMessageRead")),
    editUserProfile: t(pTypes("editUserProfile")),
    changePassword: t(pTypes("changePassword")),
    changeEmail: t(pTypes("changeEmail")),
    createAiInferenceJob: t(pTypes("createAiInferenceJob")),
    decompressFile: t(pTypes("decompressFile")),
    unlockUser: t(pTypes("unlockUser")),
    setTenantUserDefaultQuota: t(pTypes("setTenantUserDefaultQuota")),
    setTenantUserQuota: t(pTypes("setTenantUserQuota")),
    batchSetTenantUsersQuota: t(pTypes("batchSetTenantUsersQuota")),
    authorizeApp: t(pTypes("authorizeApp")),
    unauthorizeApp: t(pTypes("unauthorizeApp")),
    migrateNode: t(pTypes("migrateNode")),
    activateNode: t(pTypes("activateNode")),
    addToDefaultApps: t(pTypes("addToDefaultApps")),
    removeFromDefaultApps: t(pTypes("removeFromDefaultApps")),
    syncTenantUsersStorageUsage: t(pTypes("syncTenantUsersStorageUsage")),
    authorizeCluster: t(pTypes("authorizeCluster")),
    unauthorizeCluster: t(pTypes("unauthorizeCluster")),
    authorizePartition: t(pTypes("authorizePartition")),
    unauthorizePartition: t(pTypes("unauthorizePartition")),
    addToDefaultClusters: t(pTypes("addToDefaultClusters")),
    removeFromDefaultClusters: t(pTypes("removeFromDefaultClusters")),
    addToDefaultPartitions: t(pTypes("addToDefaultPartitions")),
    removeFromDefaultPartitions: t(pTypes("removeFromDefaultPartitions")),
    changeJobPrice: t(pTypes("changeJobPrice")),
    changeJobPlatformPrice: t(pTypes("changeJobPlatformPrice")),
  };
};

type OperationTextsArgsTransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string | React.ReactNode;

export const getOperationDetail = (
  operationEvent: OperationEvent,
  t: OperationTextsTransType,
  tArgs: OperationTextsArgsTransType,
  languageId: string,
  publicConfigClusters: Record<string, Cluster>,
) => {
  try {
    if (!operationEvent) {
      return "-";
    }

    const logEvent = operationEvent.$case;

    switch (logEvent) {
      case "login":
        return "-";
      case "logout":
        return "-";
      case "submitJob": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("submitJob"), [clusterName, String(operationEvent[logEvent].jobId || "-")]);
      }
      case "endJob": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("endJob"), [clusterName, String(operationEvent[logEvent].jobId || "-")]);
      }
      case "addJobTemplate": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("addJobTemplate"), [clusterName, operationEvent[logEvent].jobTemplateId]);
      }
      case "deleteJobTemplate": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("deleteJobTemplate"), [clusterName, operationEvent[logEvent].jobTemplateId]);
      }
      case "updateJobTemplate": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("updateJobTemplate"), [
          clusterName,
          operationEvent[logEvent].jobTemplateId,
          operationEvent[logEvent].newJobTemplateId,
        ]);
      }
      case "shellLogin": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("shellLogin"), [clusterName, operationEvent[logEvent].loginNode]);
      }
      case "createDesktop": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createDesktop"), [
          clusterName,
          operationEvent[logEvent].loginNode || "unknown",
          operationEvent[logEvent].desktopName,
          operationEvent[logEvent].wm,
        ]);
      }
      case "deleteDesktop": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("deleteDesktop"), [
          clusterName,
          operationEvent[logEvent].loginNode,
          String(operationEvent[logEvent].desktopId),
        ]);
      }
      case "createApp": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createApp"), [
          clusterName,
          String(operationEvent[logEvent].jobId || "-"),
          operationEvent[logEvent].appName || "-",
        ]);
      }
      case "createAiTrain": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createAiTrain"), [clusterName, String(operationEvent[logEvent].jobId || "-")]);
      }
      case "createDevHost": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createDevHost"), [clusterName, String(operationEvent[logEvent].devHostId || "-")]);
      }
      case "createAiInferenceJob": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createAiInferenceJob"), [clusterName, String(operationEvent[logEvent].jobId || "-")]);
      }
      case "cancelAiTrainOrApp": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("cancelAiTrainOrApp"), [clusterName, String(operationEvent[logEvent].jobId)]);
      }
      case "saveImage":
        return t(pDetails("saveImage"), [
          String(operationEvent[logEvent].jobId),
          safeGetStringProperty(operationEvent[logEvent].imageName),
          safeGetStringProperty(operationEvent[logEvent].tag),
        ]);
      case "createFile":
        return t(pDetails("createFile"), [operationEvent[logEvent].path]);
      case "deleteFile":
        return t(pDetails("deleteFile"), [operationEvent[logEvent].path]);
      case "uploadFile": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("uploadFile"), [clusterName, operationEvent[logEvent].path]);
      }
      case "createDirectory":
        return t(pDetails("createDirectory"), [operationEvent[logEvent].path]);
      case "deleteDirectory":
        return t(pDetails("deleteDirectory"), [operationEvent[logEvent].path]);
      case "moveFileItem":
        return t(pDetails("moveFileItem"), [operationEvent[logEvent].fromPath, operationEvent[logEvent].toPath]);
      case "copyFileItem":
        return t(pDetails("copyFileItem"), [operationEvent[logEvent].fromPath, operationEvent[logEvent].toPath]);
      case "compressFiles":
        return t(pDetails("compressFiles"), [operationEvent[logEvent].paths, operationEvent[logEvent].archivePath]);
      case "setJobTimeLimit": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("setJobTimeLimit"), [
          clusterName,
          String(operationEvent[logEvent].jobId),
          String(Math.abs(operationEvent[logEvent].limitMinutes)),
        ]);
      }
      case "createImage": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createImage"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].imageName),
          safeGetStringProperty(operationEvent[logEvent].tag),
        ]);
      }
      case "updateImage": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("updateImage"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].imageName),
          safeGetStringProperty(operationEvent[logEvent].tag),
        ]);
      }
      case "shareImage": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("shareImage"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].imageName),
          safeGetStringProperty(operationEvent[logEvent].tag),
        ]);
      }
      case "deleteImage": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("deleteImage"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].imageName),
          safeGetStringProperty(operationEvent[logEvent].tag),
        ]);
      }
      case "copyImage": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);

        return t(pDetails("copyImage"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].sourceImageName),
          safeGetStringProperty(operationEvent[logEvent].sourceImageTag),
          safeGetStringProperty(operationEvent[logEvent].targetImageName),
          safeGetStringProperty(operationEvent[logEvent].targetImageTag),
        ]);
      }
      case "createDataset": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createDataset"), [clusterName, safeGetStringProperty(operationEvent[logEvent].datasetName)]);
      }
      case "updateDataset":
        return t(pDetails("updateDataset"), [safeGetStringProperty(operationEvent[logEvent].datasetName)]);
      case "deleteDataset":
        return t(pDetails("deleteDataset"), [safeGetStringProperty(operationEvent[logEvent].datasetName)]);
      case "createDatasetVersion":
        return t(pDetails("createDatasetVersion"), [
          safeGetStringProperty(operationEvent[logEvent].datasetName),
          safeGetStringProperty(operationEvent[logEvent].datasetVersionName),
        ]);
      case "updateDatasetVersion":
        return t(pDetails("updateDatasetVersion"), [
          safeGetStringProperty(operationEvent[logEvent].datasetName),
          safeGetStringProperty(operationEvent[logEvent].datasetVersionName),
        ]);
      case "shareDatasetVersion":
        return t(pDetails("shareDatasetVersion"), [
          safeGetStringProperty(operationEvent[logEvent].datasetName),
          safeGetStringProperty(operationEvent[logEvent].datasetVersionName),
        ]);
      case "copyDatasetVersion":
        return t(pDetails("copyDatasetVersion"), [
          safeGetStringProperty(operationEvent[logEvent].sourceDatasetName),
          safeGetStringProperty(operationEvent[logEvent].sourceDatasetVersionName),
          safeGetStringProperty(operationEvent[logEvent].targetDatasetName),
          safeGetStringProperty(operationEvent[logEvent].targetDatasetVersionName),
        ]);
      case "deleteDatasetVersion":
        return t(pDetails("deleteDatasetVersion"), [
          safeGetStringProperty(operationEvent[logEvent].datasetName),
          safeGetStringProperty(operationEvent[logEvent].datasetVersionName),
        ]);
      case "createAlgorithm": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createAlgorithm"), [
          clusterName,
          safeGetStringProperty(operationEvent[logEvent].algorithmName),
        ]);
      }
      case "updateAlgorithm": {
        return t(pDetails("updateAlgorithm"), [safeGetStringProperty(operationEvent[logEvent].algorithmName)]);
      }
      case "deleteAlgorithm":
        return t(pDetails("deleteAlgorithm"), [safeGetStringProperty(operationEvent[logEvent].algorithmName)]);
      case "createAlgorithmVersion":
        return t(pDetails("createAlgorithmVersion"), [
          safeGetStringProperty(operationEvent[logEvent].algorithmName),
          safeGetStringProperty(operationEvent[logEvent].algorithmVersionName),
        ]);
      case "updateAlgorithmVersion":
        return t(pDetails("updateAlgorithmVersion"), [
          safeGetStringProperty(operationEvent[logEvent].algorithmName),
          safeGetStringProperty(operationEvent[logEvent].algorithmVersionName),
        ]);
      case "shareAlgorithmVersion":
        return t(pDetails("shareAlgorithmVersion"), [
          safeGetStringProperty(operationEvent[logEvent].algorithmName),
          safeGetStringProperty(operationEvent[logEvent].algorithmVersionName),
        ]);
      case "copyAlgorithmVersion":
        return t(pDetails("copyAlgorithmVersion"), [
          safeGetStringProperty(operationEvent[logEvent].sourceAlgorithmName),
          safeGetStringProperty(operationEvent[logEvent].sourceAlgorithmVersionName),
          safeGetStringProperty(operationEvent[logEvent].targetAlgorithmName),
          safeGetStringProperty(operationEvent[logEvent].targetAlgorithmVersionName),
        ]);
      case "deleteAlgorithmVersion":
        return t(pDetails("deleteAlgorithmVersion"), [
          safeGetStringProperty(operationEvent[logEvent].algorithmName),
          safeGetStringProperty(operationEvent[logEvent].algorithmVersionName),
        ]);
      case "createModel": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("createModel"), [clusterName, safeGetStringProperty(operationEvent[logEvent].modelName)]);
      }
      case "updateModel":
        return t(pDetails("updateModel"), [safeGetStringProperty(operationEvent[logEvent].modelName)]);
      case "deleteModel":
        return t(pDetails("deleteModel"), [safeGetStringProperty(operationEvent[logEvent].modelName)]);
      case "createModelVersion":
        return t(pDetails("createModelVersion"), [
          safeGetStringProperty(operationEvent[logEvent].modelName),
          safeGetStringProperty(operationEvent[logEvent].modelVersionName),
        ]);
      case "updateModelVersion":
        return t(pDetails("updateModelVersion"), [
          safeGetStringProperty(operationEvent[logEvent].modelName),
          safeGetStringProperty(operationEvent[logEvent].modelVersionName),
        ]);
      case "shareModelVersion":
        return t(pDetails("shareModelVersion"), [
          safeGetStringProperty(operationEvent[logEvent].modelName),
          safeGetStringProperty(operationEvent[logEvent].modelVersionName),
        ]);
      case "copyModelVersion":
        return t(pDetails("copyModelVersion"), [
          safeGetStringProperty(operationEvent[logEvent].sourceModelName),
          safeGetStringProperty(operationEvent[logEvent].sourceModelVersionName),
          safeGetStringProperty(operationEvent[logEvent].targetModelName),
          safeGetStringProperty(operationEvent[logEvent].targetModelVersionName),
        ]);
      case "deleteModelVersion":
        return t(pDetails("deleteModelVersion"), [
          safeGetStringProperty(operationEvent[logEvent].modelName),
          safeGetStringProperty(operationEvent[logEvent].modelVersionName),
        ]);
      case "createUser":
        return t(pDetails("createUser"), [operationEvent[logEvent].userId]);
      case "addUserToAccount":
        return t(pDetails("addUserToAccount"), [operationEvent[logEvent].userId, operationEvent[logEvent].accountName]);
      case "removeUserFromAccount":
        return t(pDetails("removeUserFromAccount"), [
          operationEvent[logEvent].userId,
          operationEvent[logEvent].accountName,
        ]);
      case "setAccountAdmin":
        return t(pDetails("setAccountAdmin"), [operationEvent[logEvent].userId, operationEvent[logEvent].accountName]);
      case "unsetAccountAdmin":
        return t(pDetails("unsetAccountAdmin"), [
          operationEvent[logEvent].userId,
          operationEvent[logEvent].accountName,
        ]);
      case "blockUser":
        return t(pDetails("blockUser"), [operationEvent[logEvent].accountName, operationEvent[logEvent].userId]);
      case "unblockUser":
        return t(pDetails("unblockUser"), [operationEvent[logEvent].accountName, operationEvent[logEvent].userId]);
      case "accountSetChargeLimit":
        return t(pDetails("accountSetChargeLimit"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].userId,
          nullableMoneyToString(operationEvent[logEvent].limit),
        ]);
      case "accountUnsetChargeLimit":
        return t(pDetails("accountUnsetChargeLimit"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].userId,
        ]);
      case "setTenantBilling": {
        const clusterName = getClusterName(
          operationEvent[logEvent].path.split(".")[0],
          languageId,
          publicConfigClusters,
        );
        const path = clusterName + "." + operationEvent[logEvent].path.split(".").slice(1).join(".");
        return t(pDetails("setTenantBilling"), [
          operationEvent[logEvent].tenantName,
          path,
          nullableMoneyToString(operationEvent[logEvent].price),
        ]);
      }
      case "setTenantAdmin":
        return t(pDetails("setTenantAdmin"), [operationEvent[logEvent].userId, operationEvent[logEvent].tenantName]);
      case "unsetTenantAdmin":
        return t(pDetails("unsetTenantAdmin"), [operationEvent[logEvent].userId, operationEvent[logEvent].tenantName]);
      case "setTenantFinance":
        return t(pDetails("setTenantFinance"), [operationEvent[logEvent].userId, operationEvent[logEvent].tenantName]);
      case "unsetTenantFinance":
        return t(pDetails("unsetTenantFinance"), [
          operationEvent[logEvent].userId,
          operationEvent[logEvent].tenantName,
        ]);
      case "tenantChangePassword":
        return t(pDetails("tenantChangePassword"), [operationEvent[logEvent].userId]);
      case "deleteUser":
        return t(pDetails("deleteUser"), [operationEvent[logEvent].userId]);
      case "createAccount":
        return t(pDetails("createAccount"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].accountOwner,
        ]);
      case "deleteAccount":
        return t(pDetails("deleteAccount"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].accountOwner || "-",
        ]);
      case "addAccountToWhitelist":
        return t(pDetails("addAccountToWhitelist"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].tenantName,
        ]);
      case "removeAccountFromWhitelist":
        return t(pDetails("removeAccountFromWhitelist"), [
          operationEvent[logEvent].accountName,
          operationEvent[logEvent].tenantName,
        ]);
      case "accountPay":
        return t(pDetails("accountPay"), [
          operationEvent[logEvent].accountName,
          nullableMoneyToString(operationEvent[logEvent].amount),
        ]);
      case "blockAccount":
        return t(pDetails("blockAccount"), [operationEvent[logEvent].tenantName, operationEvent[logEvent].accountName]);
      case "unblockAccount":
        return t(pDetails("unblockAccount"), [
          operationEvent[logEvent].tenantName,
          operationEvent[logEvent].accountName,
        ]);
      case "importUsers":
        return `${t(pDetails("importUsers1"), [operationEvent[logEvent].tenantName])}${operationEvent[
          logEvent
        ].importAccounts
          .map((account: { accountName: string; userIds: string[] }) =>
            tArgs(pDetails("importUsers2"), [account.accountName, account.userIds.join("、")]),
          )
          .join("; ")}`;
      case "setPlatformAdmin":
        return t(pDetails("setPlatformAdmin"), [operationEvent[logEvent].userId]);
      case "unsetPlatformAdmin":
        return t(pDetails("unsetPlatformAdmin"), [operationEvent[logEvent].userId]);
      case "setPlatformFinance":
        return t(pDetails("setPlatformFinance"), [operationEvent[logEvent].userId]);
      case "unsetPlatformFinance":
        return t(pDetails("unsetPlatformFinance"), [operationEvent[logEvent].userId]);
      case "platformChangePassword":
        return t(pDetails("platformChangePassword"), [operationEvent[logEvent].userId]);
      case "createTenant":
        return t(pDetails("createTenant"), [operationEvent[logEvent].tenantName, operationEvent[logEvent].tenantAdmin]);
      case "tenantPay":
        return t(pDetails("tenantPay"), [
          operationEvent[logEvent].tenantName,
          nullableMoneyToString(operationEvent[logEvent].amount),
        ]);
      case "setPlatformBilling": {
        const clusterName = getClusterName(
          operationEvent[logEvent].path.split(".")[0],
          languageId,
          publicConfigClusters,
        );
        const path = clusterName + "." + operationEvent[logEvent].path.split(".").slice(1).join(".");
        return t(pDetails("setPlatformBilling"), [path, nullableMoneyToString(operationEvent[logEvent].price)]);
      }
      case "submitFileItemAsJob": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("submitFileItemAsJob"), [clusterName, operationEvent[logEvent].path]);
      }
      case "exportUser":
        return operationEvent[logEvent].tenantName
          ? t(pDetails("tenantExportUser"), [operationEvent[logEvent].tenantName])
          : t(pDetails("adminExportUser"));
      case "exportAccount":
        return operationEvent[logEvent].tenantName
          ? t(pDetails("tenantExportAccount"), [operationEvent[logEvent].tenantName])
          : t(pDetails("adminExportAccount"));
      case "exportChargeRecord":
        return getExportChargeRecordDetail(operationEvent[logEvent], t);
      case "exportPayRecord":
        return getExportPayRecordDetail(operationEvent[logEvent], t);
      case "exportJobRecord":
        return getExportJobRecordDetail(operationEvent[logEvent], t);
      case "exportOperationLog":
        return getExportOperationLogDetail(operationEvent[logEvent], t);
      case "setAccountBlockThreshold":
        return operationEvent[logEvent].thresholdAmount
          ? t(pDetails("setAccountBlockThreshold"), [
              operationEvent[logEvent].accountName,
              moneyToString(operationEvent[logEvent].thresholdAmount),
            ])
          : t(pDetails("unsetAccountBlockThreshold"), [operationEvent[logEvent].accountName]);
      case "setAccountDefaultBlockThreshold":
        return t(pDetails("setAccountDefaultBlockThreshold"), [
          operationEvent[logEvent].tenantName,
          nullableMoneyToString(operationEvent[logEvent].thresholdAmount),
        ]);
      case "userChangeTenant":
        return t(pDetails("userChangeTenant"), [
          operationEvent[logEvent].userId,
          operationEvent[logEvent].previousTenantName,
          operationEvent[logEvent].newTenantName,
        ]);
      case "activateCluster": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("activateCluster"), [clusterName]);
      }
      case "deactivateCluster": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("deactivateCluster"), [clusterName]);
      }
      case "exportBill":
        return getExportBillDetail(operationEvent[logEvent], t);
      case "exportUserBill":
        return getExportUserBillDetail(operationEvent[logEvent], t);
      case "customEvent": {
        const c = operationEvent[logEvent]?.content;
        return getI18nCurrentText(c, languageId);
      }
      case "changePassword":
        return t(pDetails("changePassword"), [operationEvent[logEvent]?.userId || "-"]);
      case "changeEmail":
        return t(pDetails("changeEmail"), [operationEvent[logEvent]?.userId || "-"]);
      case "editUserProfile": {
        return t(pDetails("editUserProfile"), [operationEvent[logEvent].userId]);
      }
      case "decompressFile":
        return t(pDetails("decompressFile"), [
          operationEvent[logEvent].decompressionPath,
          operationEvent[logEvent].filePath,
        ]);
      case "setTenantUserQuota":
        return t(pDetails("setTenantUserQuota"), [
          operationEvent[logEvent].userId,
          operationEvent[logEvent].cluster,
          operationEvent[logEvent].path,
          operationEvent[logEvent].storageQuota,
          operationEvent[logEvent].useTenantDefaultUserQuota ? "yes" : "no",
        ]);
      case "batchSetTenantUsersQuota":
        return t(pDetails("setTenantUserQuota"), [
          React.createElement(UserIdsDisplay, { userIds: operationEvent[logEvent].userIds }),
          operationEvent[logEvent].cluster,
          operationEvent[logEvent].path,
          operationEvent[logEvent].storageQuota,
          operationEvent[logEvent].useTenantDefaultUserQuota ? "yes" : "no",
        ]);
      case "setTenantUserDefaultQuota":
        return t(pDetails("setTenantUserDefaultQuota"), [
          operationEvent[logEvent].tenantName,
          operationEvent[logEvent].cluster,
          operationEvent[logEvent].path,
          operationEvent[logEvent].storageQuota,
        ]);
      case "syncTenantUsersStorageUsage":
        return t(pDetails("syncTenantUsersStorageUsage"), [
          operationEvent[logEvent].tenant,
          operationEvent[logEvent].cluster,
          operationEvent[logEvent].path,
        ]);
      case "authorizeApp":
      case "unauthorizeApp": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return operationEvent[logEvent].target?.$case === "accountName"
          ? t(pDetails("accountAppAuthorizationLog"), [
              clusterName,
              operationEvent[logEvent].appName,
              operationEvent[logEvent].target.accountName,
            ])
          : t(pDetails("tenantAppAuthorizationLog"), [
              clusterName,
              operationEvent[logEvent].appName,
              operationEvent[logEvent].target.tenantName,
            ]);
      }
      case "migrateNode":
        return t(pDetails("migrateNode"), [
          operationEvent[logEvent].nodeName,
          operationEvent[logEvent].originCluster,
          operationEvent[logEvent].destinationCluster,
        ]);
      case "activateNode":
        return t(pDetails("activateNode"), [
          operationEvent[logEvent].nodeName,
          operationEvent[logEvent].destinationCluster,
        ]);
      case "addToDefaultApps":
      case "removeFromDefaultApps": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("updateDefaultApp"), [
          clusterName,
          operationEvent[logEvent].appName,
          operationEvent[logEvent].tenantName,
        ]);
      }
      case "authorizeCluster":
      case "unauthorizeCluster": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return operationEvent[logEvent].target?.$case === "accountName"
          ? t(pDetails("accountClusterAuthorizationLog"), [clusterName, operationEvent[logEvent].target.accountName])
          : t(pDetails("tenantClusterAuthorizationLog"), [clusterName, operationEvent[logEvent].target.tenantName]);
      }
      case "authorizePartition":
      case "unauthorizePartition": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return operationEvent[logEvent].target?.$case === "accountName"
          ? t(pDetails("accountPartitionAuthorizationLog"), [
              clusterName,
              operationEvent[logEvent].partitionName,
              operationEvent[logEvent].target.accountName,
            ])
          : t(pDetails("tenantPartitionAuthorizationLog"), [
              clusterName,
              operationEvent[logEvent].partitionName,
              operationEvent[logEvent].target.tenantName,
            ]);
      }
      case "addToDefaultClusters":
      case "removeFromDefaultClusters": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("updateDefaultCluster"), [clusterName, operationEvent[logEvent].tenantName]);
      }
      case "addToDefaultPartitions":
      case "removeFromDefaultPartitions": {
        const clusterId = operationEvent[logEvent].clusterId;
        const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);
        return t(pDetails("updateDefaultPartition"), [
          clusterName,
          operationEvent[logEvent].partitionName,
          operationEvent[logEvent].tenantName,
        ]);
      }
      case "changeJobPrice": {
        const clusterId = operationEvent[logEvent].cluster;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("changeJobPrice"), [
          clusterName,
          operationEvent[logEvent].jobId,
          nullableMoneyToString(operationEvent[logEvent].price),
        ]);
      }
      case "changeJobPlatformPrice": {
        const clusterId = operationEvent[logEvent].cluster;
        const clusterName = getClusterNameWithUndefined(clusterId, languageId, publicConfigClusters);
        return t(pDetails("changeJobPlatformPrice"), [
          clusterName,
          operationEvent[logEvent].jobId,
          nullableMoneyToString(operationEvent[logEvent].price),
        ]);
      }
      default:
        return "-";
    }
  } catch {
    return "-";
  }
};

const getExportChargeRecordDetail = (exportChargeRecord: ExportChargeRecord, t: OperationTextsTransType) => {
  const exportChargeTarget = exportChargeRecord.target;
  if (!exportChargeTarget) {
    return "-";
  }
  const exportChargeCase = exportChargeTarget.$case;
  switch (exportChargeCase) {
    case "accountOfTenant": {
      const accountOfTenant = exportChargeTarget[exportChargeCase];
      return t(pDetails("exportAccountChargeRecordOfTenant"), [
        accountOfTenant.tenantName,
        accountOfTenant.accountName,
      ]);
    }
    case "accountsOfTenant": {
      const accountsOfTenant = exportChargeTarget[exportChargeCase];
      const { accountNames } = accountsOfTenant;
      if (accountNames.length === 0) {
        return t(pDetails("exportAllAccountsChargeRecordOfTenant"), [accountsOfTenant.tenantName]);
      } else if (accountNames.length === 1) {
        return t(pDetails("exportAccountChargeRecordOfTenant"), [accountsOfTenant.tenantName, accountNames[0]]);
      } else {
        const accountStr = accountNames.join("、");
        const resultStr = accountStr.length > 25 ? accountStr.slice(0, 25) + "…" : accountStr;
        return t(pDetails("exportAccountsChargeRecordOfTenant"), [accountsOfTenant.tenantName, resultStr]);
      }
    }
    case "accountsOfAllTenants": {
      const accountsOfAllTenants = exportChargeTarget[exportChargeCase];
      const { accountNames } = accountsOfAllTenants;
      if (accountNames.length === 0) {
        return t(pDetails("exportAllAccountsChargeRecordOfAdmin"));
      } else if (accountNames.length === 1) {
        return t(pDetails("exportAccountChargeRecordOfAdmin"), accountNames);
      } else {
        const accountStr = accountNames.join("、");
        const resultStr = accountStr.length > 25 ? accountStr.slice(0, 25) + "…" : accountStr;
        return t(pDetails("exportAccountsChargeRecordOfAdmin"), [resultStr]);
      }
    }
    case "tenant": {
      const tenant = exportChargeTarget[exportChargeCase];
      return t(pDetails("exportTenantChargeRecord"), [tenant.tenantName]);
    }
    case "allTenants":
      return t(pDetails("exportTenantsChargeRecordOfAdmin"));
    default:
      return "-";
  }
};

const getExportPayRecordDetail = (exportPayRecord: ExportPayRecord, t: OperationTextsTransType) => {
  const exportPayTarget = exportPayRecord.target;
  if (!exportPayTarget) {
    return "-";
  }
  const exportPayCase = exportPayTarget.$case;
  switch (exportPayCase) {
    case "accountsOfTenant": {
      const accountsOfTenant = exportPayTarget[exportPayCase];
      const { accountNames } = accountsOfTenant;
      if (accountNames.length === 0) {
        return t(pDetails("exportAllAccountsPayRecordOfTenant"), [accountsOfTenant.tenantName]);
      } else if (accountNames.length === 1) {
        return t(pDetails("exportAccountPayRecordOfTenant"), [accountsOfTenant.tenantName, accountNames[0]]);
      } else {
        const accountStr = accountNames.join("、");
        const resultStr = accountStr.length > 25 ? accountStr.slice(0, 25) + "…" : accountStr;
        return t(pDetails("exportAccountsPayRecordOfTenant"), [accountsOfTenant.tenantName, resultStr]);
      }
    }
    case "tenant": {
      const tenant = exportPayTarget[exportPayCase];
      return t(pDetails("exportTenantPayRecord"), [tenant.tenantName]);
    }
    case "allTenants":
      return t(pDetails("exportTenantsPayRecordOfAdmin"));
    default:
      return "-";
  }
};

const getExportJobRecordDetail = (exportJobRecord: ExportJobRecord, t: OperationTextsTransType) => {
  const exportJobTarget = exportJobRecord.target;
  if (!exportJobTarget) {
    return "-";
  }
  const exportJobCase = exportJobTarget.$case;
  switch (exportJobCase) {
    case "jobsOfTenant": {
      const jobsOfTenant = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfTenant"), [jobsOfTenant.tenantName]);
    }
    case "jobsOfJobId": {
      const jobsOfJobId = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfJobId"), [jobsOfJobId.tenantName, String(jobsOfJobId.jobId)]);
    }
    case "jobsOfJobIds": {
      const jobsOfJobIds = exportJobTarget[exportJobCase];
      const jobIdsLength = jobsOfJobIds.jobIds.length;
      const showJobIds = jobsOfJobIds.jobIds.slice(0, 3);
      const jobIdsStr = showJobIds.join(",") + (jobIdsLength > 3 ? "…" : "");

      return t(pDetails("exportJobsOfJobId"), [jobsOfJobIds.tenantName, jobIdsStr]);
    }
    case "jobsOfJobIdAndUser": {
      const jobsOfJobIdAndUser = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfJobIdAndUser"), [
        jobsOfJobIdAndUser.tenantName,
        jobsOfJobIdAndUser.userId,
        String(jobsOfJobIdAndUser.jobId),
      ]);
    }
    case "jobsOfJobIdAndAccount": {
      const jobsOfJobIdAndAccount = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfJobIdAndAccount"), [
        jobsOfJobIdAndAccount.tenantName,
        jobsOfJobIdAndAccount.accountName,
        String(jobsOfJobIdAndAccount.jobId),
      ]);
    }
    case "jobsOfAccountAndUser": {
      const jobsOfAccountAndUser = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfAccountAndUser"), [
        jobsOfAccountAndUser.tenantName,
        jobsOfAccountAndUser.userId,
        jobsOfAccountAndUser.accountName,
      ]);
    }
    case "jobsOfAccount": {
      const jobsOfAccount = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfAccount"), [jobsOfAccount.tenantName, jobsOfAccount.accountName]);
    }
    case "jobsOfUser": {
      const jobsOfUser = exportJobTarget[exportJobCase];
      return t(pDetails("exportJobsOfUser"), [jobsOfUser.tenantName, jobsOfUser.userId]);
    }
    default:
      return "-";
  }
};

const getExportOperationLogDetail = (exportOperationLog: ExportOperationLog, t: OperationTextsTransType) => {
  const exportOperationLogSource = exportOperationLog.source;
  if (!exportOperationLogSource) {
    return "-";
  }
  const sourceCase = exportOperationLogSource.$case;
  switch (sourceCase) {
    case "user": {
      const user = exportOperationLogSource.user;
      return t(pDetails("exportOperationLogFromUser"), [user.userId]);
    }
    case "account": {
      const account = exportOperationLogSource.account;
      return t(pDetails("exportOperationLogFromAccount"), [account.accountName]);
    }
    case "tenant": {
      const tenant = exportOperationLogSource.tenant;
      return t(pDetails("exportOperationLogFromTenant"), [tenant.tenantName]);
    }
    case "admin":
      return t(pDetails("exportOperationLogFromAdmin"));
    default:
      return "-";
  }
};

const getExportBillDetail = (exportBill: ExportBill, t: OperationTextsTransType) => {
  if (exportBill.tenantName) {
    if (exportBill.accountNames.length) {
      return t(pDetails("exportBillFromAccount"), [exportBill.tenantName, exportBill.accountNames.join(",")]);
    }
    return t(pDetails("exportBillFromTenant"), [exportBill.tenantName]);
  }
  if (exportBill.accountNames.length) {
    return t(pDetails("exportBillFromAdminAccount"), [exportBill.accountNames.join(",")]);
  }
  return t(pDetails("exportBillFromAdmin"));
};

const getExportUserBillDetail = (exportUserBill: ExportUserBill, t: OperationTextsTransType) => {
  return t(pDetails("exportUserBillFromAccount"), [exportUserBill.accountName]);
};
