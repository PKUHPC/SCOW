import { TimeUnit } from "@scow/protos/build/portal/job";
import { Logger } from "ts-log";


export interface JobTemplate {
  jobName: string;
  account: string;
  partition?: string | undefined;
  qos?: string | undefined;
  nodeCount: number;
  coreCount: number;
  gpuCount?: number;
  /** in minutes */
  maxTime: number;
  command: string;
  workingDirectory: string;
  output?: string;
  errorOutput?: string;
  memory?: string;
  comment?: string | undefined;
  scriptOutput?: string | undefined;
  maxTimeUnit?: TimeUnit | undefined;
}

export interface ListJobTemplatesRequest {
  userId: string;
}

export interface JobTemplateInfo {
  id: string;
  jobName: string;
  submitTime: Date;
  comment: string | undefined;
}

export interface ListJobTemplatesReply {
  results: JobTemplateInfo[];
}

export interface GetJobTemplateRequest {
  userId: string;
  id: string;
}

export interface GetJobTemplateReply {
  template: JobTemplate;
};

export interface SaveJobTemplateRequest {
  userId: string;
  jobId: number;
  jobInfo: JobTemplate;
}

export interface SaveJobTemplateReply {

}

export interface DeleteJobTemplateRequest {
  userId: string;
  id: string;
}

export interface DeleteJobTemplateReply {

}


export interface RenameJobTemplateRequest {
  userId: string;
  id: string;
  jobName: string;
}

export interface RenameJobTemplateReply {

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
  listJobTemplates(req: ListJobTemplatesRequest, logger: Logger): Promise<ListJobTemplatesReply>;
  getJobTemplate(req: GetJobTemplateRequest, logger: Logger): Promise<GetJobTemplateReply>;
  saveJobTemplate(req: SaveJobTemplateRequest, logger: Logger): Promise<SaveJobTemplateReply>;
  deleteJobTemplate(req: DeleteJobTemplateRequest, logger: Logger): Promise<DeleteJobTemplateReply>;
  renameJobTemplate(req: RenameJobTemplateRequest, logger: Logger): Promise<RenameJobTemplateReply>;

  submitJob(req: SubmitJobRequest, logger: Logger): Promise<SubmitJobReply>;
  submitFileAsJob(req: SubmitFileAsJobRequest, logger: Logger): Promise<SubmitFileAsJobReply>;
}
