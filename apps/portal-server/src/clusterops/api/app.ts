import { Logger } from "ts-log";

export interface CreateAppRequest {
  appId: string;
  appJobName: string;
  userId: string;
  account: string;
  partition?: string;
  qos?: string;
  coreCount: number;
  /** in minutes */
  maxTime: number;
  customAttributes: Record<string, string>;
  proxyBasePath: string;
  nodeCount: number;
  gpuCount?: number;
  /** in MB */
  memoryMb?: number;
}

export interface CreateAppReply {
  sessionId: string;
  jobId: number;
};

export interface GetAppSessionsRequest {
  userId: string;
}

export interface AppSession {
  sessionId: string;
  jobName: string;
  jobId: number;
  submitTime: Date;
  appId: string;
  appName: string | undefined;
  state: string;
  dataPath: string;
  runningTime: string;
  timeLimit: string;
  reason?: string;
  host: string | undefined;
  port: number | undefined;
  user?: string | undefined;
  proxyServer?: string | undefined;
  connectPath?: string | undefined;
  appType: string | undefined;
}

export interface GetAppSessionsReply {
  sessions: AppSession[];
}

export interface ConnectToAppRequest {
  userId: string;
  sessionId: string;
  jobId: number;
}

export interface ConnectToAppReply {
  appId: string;
  host: string;
  port: number;
  password?: string;
  customFormData?: Record<string, string>;
}

export interface SubmissionInfo {
  userId: string;
  cluster: string;
  appId: string;
  appName: string;
  account: string;
  partition?: string;
  qos?: string;
  nodeCount: number;
  coreCount: number;
  gpuCount?: number;
  maxTime: number;
  submitTime?: string;
  customAttributes: Record<string, string>;
}

export interface GetAppLastSubmissionRequest {
  userId: string;
  appId: string;
}

export interface GetAppLastSubmissionReply {
  lastSubmissionInfo?: SubmissionInfo;
};

export interface RunScriptRequest {
  userId: string;
  script: string;
  timeoutSeconds: number;
}

export interface RunScriptReply {
  // 返回符合格式要求的 json 字符串
  output: string;
}

export interface AppOps {
  createApp(req: CreateAppRequest, logger: Logger): Promise<CreateAppReply>;
  listAppSessions(req: GetAppSessionsRequest, logger: Logger): Promise<GetAppSessionsReply>;
  connectToApp(req: ConnectToAppRequest, logger: Logger): Promise<ConnectToAppReply>;
  getAppLastSubmission(req: GetAppLastSubmissionRequest, logger: Logger): Promise<GetAppLastSubmissionReply>;
  runScript(req: RunScriptRequest, logger: Logger): Promise<RunScriptReply>;
}
