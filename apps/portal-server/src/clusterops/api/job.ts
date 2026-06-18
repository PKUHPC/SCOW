import { TimeUnit } from "@scow/protos/build/portal/job";
import { Logger } from "ts-log";

export interface JobTemplate {
  // 之前的模板的的展示名称，现在模板名继续沿用这个字段
  jobName: string;
  account: string;
  // 兼容之前的模板没有cluster参数
  cluster?: string;
  partition?: string | undefined;
  qos?: string | undefined;
  nodeCount: number;
  coreCount: number;
  gpuCount?: number;
  /** in minutes */
  maxTime: number;
  maxTimeUnit?: TimeUnit | undefined;
  command: string;
  memory?: string;
}

export interface SubmitJobRequest {
  userId: string;
  cluster: string;
  partition: string;
  nodeCount: number;
  coreCount: number;
  gpuCount?: number;
  command: string;
  jobName: string;
  qos?: string;
  maxTime: number; // 最长运行时间
  account: string;
  workingDirectory: string;
  output: string;
  errorOutput: string;
  memory?: string;
  comment?: string;
  saveAsTemplate: boolean;
  scriptOutput?: string;
  maxTimeUnit?: TimeUnit; // 最长运行时间单位，默认为MINUTES
}

interface SubmitJobReply {
  jobId: number;
}

interface SubmitFileAsJobRequest {
  cluster: string;
  userId: string;
  filePath: string;
}

interface SubmitFileAsJobReply {
  jobId: number;
}

export interface JobOps {
  submitJob(req: SubmitJobRequest, logger: Logger): Promise<SubmitJobReply>;
  submitFileAsJob(req: SubmitFileAsJobRequest, logger: Logger): Promise<SubmitFileAsJobReply>;
}
