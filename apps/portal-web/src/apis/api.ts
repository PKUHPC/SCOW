/* eslint-disable @stylistic/max-len */

import { apiClient } from "src/apis/client";
import type { GetClusterInfoSchema } from "src/pages/api//cluster";
import type { GetAppInitialConfigSchema } from "src/pages/api//getAppInitialConfig";
import type { getClusterConfigFilesSchema } from "src/pages/api//getClusterConfigFiles";
import type { GetClustersRuntimeInfoSchema } from "src/pages/api//getClustersRuntimeInfo";
import type { GetIsUserEnabledRootShellSchema } from "src/pages/api//getIsUserEnabledRootShell";
import type { GetUserAssociatedClusterIdsSchema } from "src/pages/api//getUserAssociatedClusterIds";
import type { GetUserAssociatedClusterPartitionsSchema } from "src/pages/api//getUserAssociatedClusterPartitions";
import type { GetUserAvailableClusterAppsSchema } from "src/pages/api//getUserAvalableClusterApps";
import type { GetUserInfoSchema } from "src/pages/api//getUserInfo";
import type { CheckAppConnectivitySchema } from "src/pages/api/app/checkConnectivity";
import type { CheckShadowDeskConnectivitySchema } from "src/pages/api/app/checkShadowDeskConnectivity";
import type { ConnectToAppSchema } from "src/pages/api/app/connectToApp";
import type { CreateAppSessionSchema } from "src/pages/api/app/createAppSession";
import type { GetAllClustersAvailableAppsSchema } from "src/pages/api/app/getAllClustersAvailableApps";
import type { GetAppLastSubmissionSchema } from "src/pages/api/app/getAppLastSubmission";
import type { GetAppMetadataSchema } from "src/pages/api/app/getAppMetadata";
import type { GetAppSessionsSchema } from "src/pages/api/app/getAppSessions";
import type { ListAvailableAppsSchema } from "src/pages/api/app/listAvailableApps";
import type { AuthCallbackSchema } from "src/pages/api/auth/callback";
import type { LogoutSchema } from "src/pages/api/auth/logout";
import type { ValidateTokenSchema } from "src/pages/api/auth/validateToken";
import type { GetAllClusterNodesInfoSchema } from "src/pages/api/dashboard/getAllClusterNodesInfo";
import type { GetAllClustersInfoSchema } from "src/pages/api/dashboard/getAllClustersInfo";
import type { GetAllSummaryClustersInfoSchema } from "src/pages/api/dashboard/getAllSummaryClustersInfo";
import type { GetClusterRunningInfoSchema } from "src/pages/api/dashboard/getClusterInfo";
import type { GetClusterNodesInfoSchema } from "src/pages/api/dashboard/getClusterNodesInfo";
import type { GetQuickEntriesSchema } from "src/pages/api/dashboard/getQuickEntries";
import type { SaveQuickEntriesSchema } from "src/pages/api/dashboard/saveQuickEntries";
import type { CreateDesktopSchema } from "src/pages/api/desktop/createDesktop";
import type { KillDesktopSchema } from "src/pages/api/desktop/killDesktop";
import type { LaunchDesktopSchema } from "src/pages/api/desktop/launchDesktop";
import type { ListAvailableWmsSchema } from "src/pages/api/desktop/listAvailableWms";
import type { ListDesktopsSchema } from "src/pages/api/desktop/listDesktops";
import type { CheckTransferKeySchema } from "src/pages/api/file/checkTransferKey";
import type { CompressAndDownloadFileSchema } from "src/pages/api/file/compressAndDownload";
import type { CompressFilesSchema } from "src/pages/api/file/compressFiles";
import type { CopyFileItemSchema } from "src/pages/api/file/copy";
import type { CreateFileSchema } from "src/pages/api/file/createFile";
import type { DecompressFileSchema } from "src/pages/api/file/decompressFile";
import type { DeleteDirSchema } from "src/pages/api/file/deleteDir";
import type { DeleteFileSchema } from "src/pages/api/file/deleteFile";
import type { DownloadFileSchema } from "src/pages/api/file/download";
import type { FileExistSchema } from "src/pages/api/file/fileExist";
import type { GetFileMetadataSchema } from "src/pages/api/file/getFileMetadata";
import type { GetFileTypeSchema } from "src/pages/api/file/getFileType";
import type { GetHomeDirectorySchema } from "src/pages/api/file/getHome";
import type { InitMultipartUploadSchema } from "src/pages/api/file/initMultipartUpload";
import type { ListFileSchema } from "src/pages/api/file/list";
import type { ListAvailableTransferClustersSchema } from "src/pages/api/file/listAvailableTransferClusters";
import type { MergeFileChunksSchema } from "src/pages/api/file/mergeFileChunks";
import type { MkdirSchema } from "src/pages/api/file/mkdir";
import type { MoveFileItemSchema } from "src/pages/api/file/move";
import type { QueryFileTransferProgressSchema } from "src/pages/api/file/queryFileTransferProgress";
import type { StartFileTransferSchema } from "src/pages/api/file/startFileTransfer";
import type { TerminateFileTransferSchema } from "src/pages/api/file/terminateFileTransfer";
import type { UploadFileSchema } from "src/pages/api/file/upload";
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
import type { GetUnreadMessagesSchema } from "src/pages/api/notification/getUnreadMessages";
import type { MarkMessageReadSchema } from "src/pages/api/notification/markMessageRead";
import type { ChangeEmailSchema } from "src/pages/api/profile/changeEmail";
import type { ChangePasswordSchema } from "src/pages/api/profile/changePassword";
import type { CheckPasswordSchema } from "src/pages/api/profile/checkPassword";
import type { getUserStorageInfoSchema } from "src/pages/api/storage/getUserStorageUsage";


export const api = {
  checkAppConnectivity: apiClient.fromTypeboxRoute<typeof CheckAppConnectivitySchema>("GET", "/api/app/checkConnectivity"),
  checkShadowDeskConnectivity: apiClient.fromTypeboxRoute<typeof CheckShadowDeskConnectivitySchema>("GET", "/api/app/checkShadowDeskConnectivity"),
  connectToApp: apiClient.fromTypeboxRoute<typeof ConnectToAppSchema>("POST", "/api/app/connectToApp"),
  createAppSession: apiClient.fromTypeboxRoute<typeof CreateAppSessionSchema>("POST", "/api/app/createAppSession"),
  getAllClustersAvailableApps: apiClient.fromTypeboxRoute<typeof GetAllClustersAvailableAppsSchema>("GET", "/api/app/getAllClustersAvailableApps"),
  getAppLastSubmission: apiClient.fromTypeboxRoute<typeof GetAppLastSubmissionSchema>("GET", "/api/app/getAppLastSubmission"),
  getAppMetadata: apiClient.fromTypeboxRoute<typeof GetAppMetadataSchema>("GET", "/api/app/getAppMetadata"),
  getAppSessions: apiClient.fromTypeboxRoute<typeof GetAppSessionsSchema>("GET", "/api/app/getAppSessions"),
  listAvailableApps: apiClient.fromTypeboxRoute<typeof ListAvailableAppsSchema>("GET", "/api/app/listAvailableApps"),
  authCallback: apiClient.fromTypeboxRoute<typeof AuthCallbackSchema>("GET", "/api/auth/callback"),
  logout: apiClient.fromTypeboxRoute<typeof LogoutSchema>("DELETE", "/api/auth/logout"),
  validateToken: apiClient.fromTypeboxRoute<typeof ValidateTokenSchema>("GET", "/api/auth/validateToken"),
  getClusterInfo: apiClient.fromTypeboxRoute<typeof GetClusterInfoSchema>("GET", "/api//cluster"),
  getAllClusterNodesInfo: apiClient.fromTypeboxRoute<typeof GetAllClusterNodesInfoSchema>("GET", "/api/dashboard/getAllClusterNodesInfo"),
  getAllSummaryClustersInfo: apiClient.fromTypeboxRoute<typeof GetAllSummaryClustersInfoSchema>("GET", "/api/dashboard/getAllSummaryClustersInfo"),
  getAllClustersInfo: apiClient.fromTypeboxRoute<typeof GetAllClustersInfoSchema>("GET", "/api/dashboard/getAllClustersInfo"),
  getClusterRunningInfo: apiClient.fromTypeboxRoute<typeof GetClusterRunningInfoSchema>("GET", "/api/dashboard/getClusterInfo"),
  getClusterNodesInfo: apiClient.fromTypeboxRoute<typeof GetClusterNodesInfoSchema>("GET", "/api/dashboard/getClusterNodesInfo"),
  getQuickEntries: apiClient.fromTypeboxRoute<typeof GetQuickEntriesSchema>("GET", "/api/dashboard/getQuickEntries"),
  saveQuickEntries: apiClient.fromTypeboxRoute<typeof SaveQuickEntriesSchema>("POST", "/api/dashboard/saveQuickEntries"),
  createDesktop: apiClient.fromTypeboxRoute<typeof CreateDesktopSchema>("POST", "/api/desktop/createDesktop"),
  killDesktop: apiClient.fromTypeboxRoute<typeof KillDesktopSchema>("POST", "/api/desktop/killDesktop"),
  launchDesktop: apiClient.fromTypeboxRoute<typeof LaunchDesktopSchema>("POST", "/api/desktop/launchDesktop"),
  listAvailableWms: apiClient.fromTypeboxRoute<typeof ListAvailableWmsSchema>("GET", "/api/desktop/listAvailableWms"),
  listDesktops: apiClient.fromTypeboxRoute<typeof ListDesktopsSchema>("GET", "/api/desktop/listDesktops"),
  checkTransferKey: apiClient.fromTypeboxRoute<typeof CheckTransferKeySchema>("POST", "/api/file/checkTransferKey"),
  compressAndDownloadFile: apiClient.fromTypeboxRoute<typeof CompressAndDownloadFileSchema>("GET", "/api/file/compressAndDownload"),
  compressFiles: apiClient.fromTypeboxRoute<typeof CompressFilesSchema>("PATCH", "/api/file/compressFiles"),
  copyFileItem: apiClient.fromTypeboxRoute<typeof CopyFileItemSchema>("PATCH", "/api/file/copy"),
  createFile: apiClient.fromTypeboxRoute<typeof CreateFileSchema>("POST", "/api/file/createFile"),
  decompressFile: apiClient.fromTypeboxRoute<typeof DecompressFileSchema>("PATCH", "/api/file/decompressFile"),
  deleteDir: apiClient.fromTypeboxRoute<typeof DeleteDirSchema>("DELETE", "/api/file/deleteDir"),
  deleteFile: apiClient.fromTypeboxRoute<typeof DeleteFileSchema>("DELETE", "/api/file/deleteFile"),
  downloadFile: apiClient.fromTypeboxRoute<typeof DownloadFileSchema>("GET", "/api/file/download"),
  fileExist: apiClient.fromTypeboxRoute<typeof FileExistSchema>("GET", "/api/file/fileExist"),
  getFileMetadata: apiClient.fromTypeboxRoute<typeof GetFileMetadataSchema>("GET", "/api/file/getFileMetadata"),
  getFileType: apiClient.fromTypeboxRoute<typeof GetFileTypeSchema>("GET", "/api/file/getFileType"),
  getHomeDirectory: apiClient.fromTypeboxRoute<typeof GetHomeDirectorySchema>("GET", "/api/file/getHome"),
  initMultipartUpload: apiClient.fromTypeboxRoute<typeof InitMultipartUploadSchema>("POST", "/api/file/initMultipartUpload"),
  listFile: apiClient.fromTypeboxRoute<typeof ListFileSchema>("GET", "/api/file/list"),
  listAvailableTransferClusters: apiClient.fromTypeboxRoute<typeof ListAvailableTransferClustersSchema>("GET", "/api/file/listAvailableTransferClusters"),
  mergeFileChunks: apiClient.fromTypeboxRoute<typeof MergeFileChunksSchema>("POST", "/api/file/mergeFileChunks"),
  mkdir: apiClient.fromTypeboxRoute<typeof MkdirSchema>("POST", "/api/file/mkdir"),
  moveFileItem: apiClient.fromTypeboxRoute<typeof MoveFileItemSchema>("PATCH", "/api/file/move"),
  queryFileTransferProgress: apiClient.fromTypeboxRoute<typeof QueryFileTransferProgressSchema>("GET", "/api/file/queryFileTransferProgress"),
  startFileTransfer: apiClient.fromTypeboxRoute<typeof StartFileTransferSchema>("POST", "/api/file/startFileTransfer"),
  terminateFileTransfer: apiClient.fromTypeboxRoute<typeof TerminateFileTransferSchema>("POST", "/api/file/terminateFileTransfer"),
  uploadFile: apiClient.fromTypeboxRoute<typeof UploadFileSchema>("POST", "/api/file/upload"),
  getAppInitialConfig: apiClient.fromTypeboxRoute<typeof GetAppInitialConfigSchema>("GET", "/api//getAppInitialConfig"),
  getClusterConfigFiles: apiClient.fromTypeboxRoute<typeof getClusterConfigFilesSchema>("GET", "/api//getClusterConfigFiles"),
  getClustersRuntimeInfo: apiClient.fromTypeboxRoute<typeof GetClustersRuntimeInfoSchema>("GET", "/api//getClustersRuntimeInfo"),
  getIsUserEnabledRootShell: apiClient.fromTypeboxRoute<typeof GetIsUserEnabledRootShellSchema>("GET", "/api//getIsUserEnabledRootShell"),
  getUserAssociatedClusterIds: apiClient.fromTypeboxRoute<typeof GetUserAssociatedClusterIdsSchema>("GET", "/api//getUserAssociatedClusterIds"),
  getUserAssociatedClusterPartitions: apiClient.fromTypeboxRoute<typeof GetUserAssociatedClusterPartitionsSchema>("GET", "/api//getUserAssociatedClusterPartitions"),
  getUserAvailableClusterApps: apiClient.fromTypeboxRoute<typeof GetUserAvailableClusterAppsSchema>("GET", "/api//getUserAvalableClusterApps"),
  getUserInfo: apiClient.fromTypeboxRoute<typeof GetUserInfoSchema>("GET", "/api//getUserInfo"),
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
  getUnreadMessages: apiClient.fromTypeboxRoute<typeof GetUnreadMessagesSchema>("GET", "/api/notification/getUnreadMessages"),
  markMessageRead: apiClient.fromTypeboxRoute<typeof MarkMessageReadSchema>("POST", "/api/notification/markMessageRead"),
  changeEmail: apiClient.fromTypeboxRoute<typeof ChangeEmailSchema>("PATCH", "/api/profile/changeEmail"),
  changePassword: apiClient.fromTypeboxRoute<typeof ChangePasswordSchema>("PATCH", "/api/profile/changePassword"),
  checkPassword: apiClient.fromTypeboxRoute<typeof CheckPasswordSchema>("GET", "/api/profile/checkPassword"),
  getUserStorageInfo: apiClient.fromTypeboxRoute<typeof getUserStorageInfoSchema>("GET", "/api/storage/getUserStorageUsage"),
};
