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

/* eslint-disable @stylistic/max-len */

import { apiClient } from "src/apis/client";
import type { GetClusterInfoSchema } from "src/pages/api//cluster";
import type { getClusterConfigFilesSchema } from "src/pages/api//getClusterConfigFiles";
import type { GetClustersRuntimeInfoSchema } from "src/pages/api//getClustersRuntimeInfo";
import type { CheckAppConnectivitySchema } from "src/pages/api/app/checkConnectivity";
import type { ConnectToAppSchema } from "src/pages/api/app/connectToApp";
import type { CreateAppSessionSchema } from "src/pages/api/app/createAppSession";
import type { GetAppLastSubmissionSchema } from "src/pages/api/app/getAppLastSubmission";
import type { GetAppMetadataSchema } from "src/pages/api/app/getAppMetadata";
import type { GetAppSessionsSchema } from "src/pages/api/app/getAppSessions";
import type { ListAvailableAppsSchema } from "src/pages/api/app/listAvailableApps";
import type { AuthCallbackSchema } from "src/pages/api/auth/callback";
import type { LogoutSchema } from "src/pages/api/auth/logout";
import type { ValidateTokenSchema } from "src/pages/api/auth/validateToken";
import type { GetClusterRunningInfoSchema } from "src/pages/api/dashboard/getClusterInfo";
import type { GetQuickEntriesSchema } from "src/pages/api/dashboard/getQuickEntries";
import type { SaveQuickEntriesSchema } from "src/pages/api/dashboard/saveQuickEntries";
import type { CreateDesktopSchema } from "src/pages/api/desktop/createDesktop";
import type { KillDesktopSchema } from "src/pages/api/desktop/killDesktop";
import type { LaunchDesktopSchema } from "src/pages/api/desktop/launchDesktop";
import type { ListAvailableWmsSchema } from "src/pages/api/desktop/listAvailableWms";
import type { ListDesktopsSchema } from "src/pages/api/desktop/listDesktops";
import type { CheckTransferKeySchema } from "src/pages/api/file/checkTransferKey";
import type { CopyFileItemSchema } from "src/pages/api/file/copy";
import type { CreateFileSchema } from "src/pages/api/file/createFile";
import type { DeleteDirSchema } from "src/pages/api/file/deleteDir";
import type { DeleteFileSchema } from "src/pages/api/file/deleteFile";
import type { DownloadFileSchema } from "src/pages/api/file/download";
import type { FileExistSchema } from "src/pages/api/file/fileExist";
import type { GetFileTypeSchema } from "src/pages/api/file/getFileType";
import type { GetHomeDirectorySchema } from "src/pages/api/file/getHome";
import type { ListFileSchema } from "src/pages/api/file/list";
import type { ListAvailableTransferClustersSchema } from "src/pages/api/file/listAvailableTransferClusters";
import type { MkdirSchema } from "src/pages/api/file/mkdir";
import type { MoveFileItemSchema } from "src/pages/api/file/move";
import type { QueryFileTransferProgressSchema } from "src/pages/api/file/queryFileTransferProgress";
import type { StartFileTransferSchema } from "src/pages/api/file/startFileTransfer";
import type { TerminateFileTransferSchema } from "src/pages/api/file/terminateFileTransfer";
import type { UploadFileSchema } from "src/pages/api/file/upload";
import type { GetUserAssociatedClusterIdsSchema } from "src/pages/api/getUserAssociatedClusterIds";
import type { CancelJobSchema } from "src/pages/api/job/cancelJob";
import type { DeleteJobTemplateSchema } from "src/pages/api/job/deleteJobTemplate";
import type { GetAccountsSchema } from "src/pages/api/job/getAccounts";
import type { GetAllJobsSchema } from "src/pages/api/job/getAllJobs";
import type { GetAvailablePartitionsForClusterSchema } from "src/pages/api/job/getAvailablePartitionsForCluster";
import type { GetJobTemplateSchema } from "src/pages/api/job/getJobTemplate";
import type { GetRunningJobsSchema } from "src/pages/api/job/getRunningJobs";
import type { ListJobTemplatesSchema } from "src/pages/api/job/listJobTemplates";
import type { RenameJobTemplateSchema } from "src/pages/api/job/renameJobTemplate";
import type { SubmitFileAsJobSchema } from "src/pages/api/job/submitFileAsJob";
import type { SubmitJobSchema } from "src/pages/api/job/submitJob";
import type { ChangePasswordSchema } from "src/pages/api/profile/changePassword";
import type { CheckPasswordSchema } from "src/pages/api/profile/checkPassword";


export const api = {
  checkAppConnectivity: apiClient.fromTypeboxRoute<typeof CheckAppConnectivitySchema>("GET", "/api/app/checkConnectivity"),
  connectToApp: apiClient.fromTypeboxRoute<typeof ConnectToAppSchema>("POST", "/api/app/connectToApp"),
  createAppSession: apiClient.fromTypeboxRoute<typeof CreateAppSessionSchema>("POST", "/api/app/createAppSession"),
  getAppLastSubmission: apiClient.fromTypeboxRoute<typeof GetAppLastSubmissionSchema>("GET", "/api/app/getAppLastSubmission"),
  getAppMetadata: apiClient.fromTypeboxRoute<typeof GetAppMetadataSchema>("GET", "/api/app/getAppMetadata"),
  getAppSessions: apiClient.fromTypeboxRoute<typeof GetAppSessionsSchema>("GET", "/api/app/getAppSessions"),
  listAvailableApps: apiClient.fromTypeboxRoute<typeof ListAvailableAppsSchema>("GET", "/api/app/listAvailableApps"),
  authCallback: apiClient.fromTypeboxRoute<typeof AuthCallbackSchema>("GET", "/api/auth/callback"),
  logout: apiClient.fromTypeboxRoute<typeof LogoutSchema>("DELETE", "/api/auth/logout"),
  validateToken: apiClient.fromTypeboxRoute<typeof ValidateTokenSchema>("GET", "/api/auth/validateToken"),
  getClusterInfo: apiClient.fromTypeboxRoute<typeof GetClusterInfoSchema>("GET", "/api//cluster"),
  getClusterRunningInfo: apiClient.fromTypeboxRoute<typeof GetClusterRunningInfoSchema>("GET", "/api/dashboard/getClusterInfo"),
  getQuickEntries: apiClient.fromTypeboxRoute<typeof GetQuickEntriesSchema>("GET", "/api/dashboard/getQuickEntries"),
  saveQuickEntries: apiClient.fromTypeboxRoute<typeof SaveQuickEntriesSchema>("POST", "/api/dashboard/saveQuickEntries"),
  createDesktop: apiClient.fromTypeboxRoute<typeof CreateDesktopSchema>("POST", "/api/desktop/createDesktop"),
  killDesktop: apiClient.fromTypeboxRoute<typeof KillDesktopSchema>("POST", "/api/desktop/killDesktop"),
  launchDesktop: apiClient.fromTypeboxRoute<typeof LaunchDesktopSchema>("POST", "/api/desktop/launchDesktop"),
  listAvailableWms: apiClient.fromTypeboxRoute<typeof ListAvailableWmsSchema>("GET", "/api/desktop/listAvailableWms"),
  listDesktops: apiClient.fromTypeboxRoute<typeof ListDesktopsSchema>("GET", "/api/desktop/listDesktops"),
  checkTransferKey: apiClient.fromTypeboxRoute<typeof CheckTransferKeySchema>("POST", "/api/file/checkTransferKey"),
  copyFileItem: apiClient.fromTypeboxRoute<typeof CopyFileItemSchema>("PATCH", "/api/file/copy"),
  createFile: apiClient.fromTypeboxRoute<typeof CreateFileSchema>("POST", "/api/file/createFile"),
  deleteDir: apiClient.fromTypeboxRoute<typeof DeleteDirSchema>("DELETE", "/api/file/deleteDir"),
  deleteFile: apiClient.fromTypeboxRoute<typeof DeleteFileSchema>("DELETE", "/api/file/deleteFile"),
  downloadFile: apiClient.fromTypeboxRoute<typeof DownloadFileSchema>("GET", "/api/file/download"),
  fileExist: apiClient.fromTypeboxRoute<typeof FileExistSchema>("GET", "/api/file/fileExist"),
  getFileType: apiClient.fromTypeboxRoute<typeof GetFileTypeSchema>("GET", "/api/file/getFileType"),
  getHomeDirectory: apiClient.fromTypeboxRoute<typeof GetHomeDirectorySchema>("GET", "/api/file/getHome"),
  listFile: apiClient.fromTypeboxRoute<typeof ListFileSchema>("GET", "/api/file/list"),
  listAvailableTransferClusters: apiClient.fromTypeboxRoute<typeof ListAvailableTransferClustersSchema>("GET", "/api/file/listAvailableTransferClusters"),
  mkdir: apiClient.fromTypeboxRoute<typeof MkdirSchema>("POST", "/api/file/mkdir"),
  moveFileItem: apiClient.fromTypeboxRoute<typeof MoveFileItemSchema>("PATCH", "/api/file/move"),
  queryFileTransferProgress: apiClient.fromTypeboxRoute<typeof QueryFileTransferProgressSchema>("GET", "/api/file/queryFileTransferProgress"),
  startFileTransfer: apiClient.fromTypeboxRoute<typeof StartFileTransferSchema>("POST", "/api/file/startFileTransfer"),
  terminateFileTransfer: apiClient.fromTypeboxRoute<typeof TerminateFileTransferSchema>("POST", "/api/file/terminateFileTransfer"),
  uploadFile: apiClient.fromTypeboxRoute<typeof UploadFileSchema>("POST", "/api/file/upload"),
  getClusterConfigFiles: apiClient.fromTypeboxRoute<typeof getClusterConfigFilesSchema>("GET", "/api//getClusterConfigFiles"),
  getClustersRuntimeInfo: apiClient.fromTypeboxRoute<typeof GetClustersRuntimeInfoSchema>("GET", "/api//getClustersRuntimeInfo"),
  cancelJob: apiClient.fromTypeboxRoute<typeof CancelJobSchema>("DELETE", "/api/job/cancelJob"),
  deleteJobTemplate: apiClient.fromTypeboxRoute<typeof DeleteJobTemplateSchema>("DELETE", "/api/job/deleteJobTemplate"),
  getAccounts: apiClient.fromTypeboxRoute<typeof GetAccountsSchema>("GET", "/api/job/getAccounts"),
  getAllJobs: apiClient.fromTypeboxRoute<typeof GetAllJobsSchema>("GET", "/api/job/getAllJobs"),
  getAvailablePartitionsForCluster: apiClient.fromTypeboxRoute<typeof GetAvailablePartitionsForClusterSchema>("GET", "/api/job/getAvailablePartitionsForCluster"),
  getJobTemplate: apiClient.fromTypeboxRoute<typeof GetJobTemplateSchema>("GET", "/api/job/getJobTemplate"),
  getRunningJobs: apiClient.fromTypeboxRoute<typeof GetRunningJobsSchema>("GET", "/api/job/getRunningJobs"),
  listJobTemplates: apiClient.fromTypeboxRoute<typeof ListJobTemplatesSchema>("GET", "/api/job/listJobTemplates"),
  renameJobTemplate: apiClient.fromTypeboxRoute<typeof RenameJobTemplateSchema>("POST", "/api/job/renameJobTemplate"),
  submitFileAsJob: apiClient.fromTypeboxRoute<typeof SubmitFileAsJobSchema>("POST", "/api/job/submitFileAsJob"),
  submitJob: apiClient.fromTypeboxRoute<typeof SubmitJobSchema>("POST", "/api/job/submitJob"),
  changePassword: apiClient.fromTypeboxRoute<typeof ChangePasswordSchema>("PATCH", "/api/profile/changePassword"),
  checkPassword: apiClient.fromTypeboxRoute<typeof CheckPasswordSchema>("GET", "/api/profile/checkPassword"),
  getUserAssociatedClusterIds: apiClient.fromTypeboxRoute<typeof GetUserAssociatedClusterIdsSchema>("GET", "/api//getUserAssociatedClusterIds"),
};
