import { Decimal } from "@scow/lib-decimal";
import { z } from "zod";

export const TaskStates = {
  scheduled:  "scheduled",
  pending:  "pending",
  active:  "active",
  completed:  "completed",
  failed:  "failed",
  hold:  "hold",
};

export const TaskStateSchema = z.union([
  z.literal("scheduled"),
  z.literal("pending"),
  z.literal("active"),
  z.literal("completed"),
  z.literal("failed"),
  z.literal("hold"),
]);


// 这是/task/submit 接口提交的任务信息
export const SubmittedTaskSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  queue: z.string().optional(),
  device: z.string(),
  qubits: z.number().optional(),
  depth: z.number().optional(),
  state: TaskStateSchema,
  shots: z.number(),
  prior: z.number().optional(),
  at: z.number(),
  ts: z.record(z.string(), z.number()).optional(),
  err: z.string().optional(),
  md5: z.string(),
  runAt: z.number().optional(),
  runDur: z.number().optional(),
  atChip: z.number().optional(),
  durChip: z.number().optional(),
  group: z.string().optional(),
  tags: z.string().optional(),
  fee: z.number().optional(),
  pragma: z.string().optional(),
});

export type SubmittedTask = z.infer<typeof SubmittedTaskSchema>;

// jupyter调用提交作业时处理后的数据格式
export const SubmitTaskRequestSchema = z.object({
  accountName: z.string(),
  tasks: z.array(z.object({
    name: z.string().optional(),
    device: z.string(),
    shots: z.number(),
    group: z.string().optional().nullable(),
    tags: z.string().optional(),
    source: z.string(),
    version: z.string().optional(),
    lang: z.string().optional(),
    remarks: z.string().optional().nullable(),
    result: z.record(z.string(), z.any()).optional(),
    qubits: z.number().optional(),
  })),
});

export type SubmitTaskRequest = z.infer<typeof SubmitTaskRequestSchema>;

export const SubmitTaskResponseSchema = z.object({
  tasks: z.array(SubmittedTaskSchema),
});

export type SubmitTaskResponse = z.infer<typeof SubmitTaskResponseSchema>;

// 这是/task/find 接口返回的任务信息
export const FoundTaskSchema = SubmittedTaskSchema.extend({
  source: z.string(),
  version: z.string().optional(),
  lang: z.string().optional(),
  remarks: z.string().optional(),
  result: z.record(z.string(), z.any()).optional(),
});

export type FoundTask = z.infer<typeof FoundTaskSchema>;

// 这是/task/detail 接口返回的任务信息
export const DetailTaskSchema = FoundTaskSchema.extend({
  optimization: z.object({
    progs: z.array(z.object({
      code: z.string().optional(),
      lang: z.string().optional(),
    })).optional(),
    pairs: z.record(z.string(), z.number()).optional(),
    depth: z.number().optional(),
  }).optional(),
});

export type DetailTask = z.infer<typeof DetailTaskSchema>;

// 这是findTask 接口返回的任务信息
export const FindTaskSchema = FoundTaskSchema.extend({
  jobId: z.number(),
  lastSyncTime: z.date(),
  submitTime: z.string(),
  account: z.string(),
  duration: z.number(),
  qits: z.instanceof(Decimal).optional(),
});
export type FindTask = z.infer<typeof FindTaskSchema>;

// 这是getTaskDetail 接口返回的任务信息
export const GetTaskDetailSchema = DetailTaskSchema.extend({
  submitTime: z.string(),
  account: z.string(),
  jobId: z.number(),
  duration: z.number(),
  qits: z.instanceof(Decimal).optional(),
});

export type GetTaskDetail = z.infer<typeof GetTaskDetailSchema>;

// 这是/task/result 接口返回的任务信息
export const GetTaskResultSchema = SubmittedTaskSchema.extend({
  result: z.record(z.string(), z.any()).optional(),
});

export type GetTaskResult = z.infer<typeof GetTaskResultSchema>;

export const EstimateTaskSchema = z.object({
  balance: z.number().optional(),
  qits: z.number(),
});

export type EstimateTask = z.infer<typeof EstimateTaskSchema>;

export interface TaskEstimate {
  source: string;
  shots: number;
  device: string;
}

export type TaskEstimateArray = TaskEstimate[];
