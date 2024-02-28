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
  extraOptions: {
    [key: string]: string;
  }
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

export type GetJobTemplateReply = {
  template: JobTemplate;
}

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

export interface JobOps {
  listJobTemplates(req: ListJobTemplatesRequest, logger: Logger): Promise<ListJobTemplatesReply>;
  getJobTemplate(req: GetJobTemplateRequest, logger: Logger): Promise<GetJobTemplateReply>;
  saveJobTemplate(req: SaveJobTemplateRequest, logger: Logger): Promise<SaveJobTemplateReply>;
  deleteJobTemplate(req: DeleteJobTemplateRequest, logger: Logger): Promise<DeleteJobTemplateReply>;
  renameJobTemplate(req: RenameJobTemplateRequest, logger: Logger): Promise<RenameJobTemplateReply>;
}
