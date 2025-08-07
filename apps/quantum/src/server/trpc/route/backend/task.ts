import type { MikroORM } from "@mikro-orm/core";
import { TRPCError } from "@trpc/server";
import {
  EstimateTaskSchema, FindTaskSchema, GetTaskDetailSchema, GetTaskResultSchema,
  SubmitTaskRequestSchema, SubmitTaskResponse, SubmitTaskResponseSchema, TaskStateSchema } from "src/models/task";
import { QuantumJob } from "src/server/entities/QuantumJob";
import { router } from "src/server/trpc/def";
import { backendApiProcedure, callBackendApi } from "src/server/trpc/route/backend/common";
import { checkDeviceAvailability, checkUserAccountPermission,
  estimateAccountCanAfford, getAccountInfo } from "src/server/trpc/route/utils";
import { logger } from "src/server/utils/logger";
import { calculateDuration } from "src/server/utils/time";
import { z } from "zod";

interface User {
  identityId: string;
}

// 数据库中记录新的提交作业
async function handleSubmitTaskRecord(
  b: z.SafeParseSuccess<SubmitTaskResponse>,
  orm: MikroORM,
  user: User,
  accountName: string,
  tenantName: string,
) {

  // 记录下用户提交的作业信息
  const em = orm.em.fork();
  const submitTime = new Date();
  for (const task of b.data.tasks) {
    if (!task.id) {
      // 如果没有ID，说明提交失败
      logger.warn(`Task submission failed, no ID returned: ${JSON.stringify(task)}`);
      continue;
    }
    const dbTask = new QuantumJob({
      submitTime,
      userId: user.identityId,
      jobId: task.id,
      state: task.state,
      lastSyncTime: submitTime,
      accountName,
      tenantName,
      info: {
        ...task,
        source: "",
      },
    });

    em.persist(dbTask);
  }

  await em.flush();

  return b.data;
}


export const task = router({
  submitTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/submit",
      },
    })
    .input(z.preprocess((val) => {

      if (val === undefined) return;
      if (typeof val !== "object" || val == null || !("accountName" in val)) {
        logger.error(`Invalid input format ${JSON.stringify(val)}`);
        throw new Error("Invalid input format");
      }

      const { accountName, ...restOfVal } = val as Record<string, any>;

      if ("0" in restOfVal) { // jupyter提交多个作业
        const tasks = Object.values(restOfVal);
        return { tasks, accountName };
      }

      return { tasks:[restOfVal], accountName };
    } , SubmitTaskRequestSchema))
    .output(SubmitTaskResponseSchema)
    .mutation(async ({ input, ctx: { orm, user } }) => {

      const userAccountPermission = await checkUserAccountPermission(user.identityId, input.accountName);

      if (!userAccountPermission) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This account ${input.accountName} is currently unavailable to the user ${user.identityId}. `,
        });
      }

      for (const task of input.tasks) {
        checkDeviceAvailability(task.device);
      }

      const { accountName } = input;

      const accountInfo = await getAccountInfo(accountName);

      const isAccountCanAfford = await estimateAccountCanAfford(accountInfo, input.tasks);

      if (!isAccountCanAfford) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `The account ${accountName} does not have enough balance to run this task. `,
        });
      }

      const resp = await callBackendApi("/task/submit", {
        method: "POST",
        body: JSON.stringify(input.tasks),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }

      return handleSubmitTaskRecord(b, orm, user, accountName, accountInfo.tenantName);
    }),

  findTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/find",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.array(z.string()).optional(),
      state: TaskStateSchema.optional(),
      device: z.string().optional(),
      // start, and
      at: z.tuple([z.number(), z.number()]).optional(),
      group: z.string().optional(),
      tags: z.string().optional(),
      name: z.string().optional(),
      md5: z.string().optional(),
      qubits: z.number().optional(),
      shots: z.number().optional(),
    }))
    .output(z.object({
      tasks: z.array(FindTaskSchema),
    }))
    .query(async ({ input, ctx: { orm, user } }) => {

      const em = orm.em.fork();

      const qb = em.createQueryBuilder(QuantumJob, "qj");

      qb.where({ "qj.userId": user.identityId });

      if (input.id) {
        qb.andWhere({ "qj.info.id": { $in: input.id } });
      }
      if (input.at) {
        qb.andWhere({ "qj.info.at": { $gte: input.at[0], $lte: input.at[1] } });
      }
      if (input.state) {
        qb.andWhere({ "qj.info.state": input.state });
      }
      if (input.group) {
        qb.andWhere({ "qj.info.group": input.group });
      }
      if (input.tags) {
        qb.andWhere({ "qj.info.tags": input.tags });
      }
      if (input.name) {
        qb.andWhere({ "qj.info.name": input.name });
      }
      if (input.md5) {
        qb.andWhere({ "qj.info.md5": input.md5 });
      }
      if (input.qubits) {
        qb.andWhere({ "qj.info.qubits": input.qubits });
      }
      if (input.shots) {
        qb.andWhere({ "qj.info.shots": input.shots });
      }

      if (input.device) {
        checkDeviceAvailability(input.device);

        // 根据 input.device 的形式，确定实际用于数据库查询的设备条件
        if (input.device.includes("?o=")) {
          // 如果 input.device 已经包含了 ?o= 后缀，则进行精确匹配
          // 使用原始 SQL 表达式和 JSON_EXTRACT
          qb.andWhere("JSON_EXTRACT(qj.info, '$.device') = ?", [input.device]);
        } else {
          // 如果 input.device 是一个基础芯片名称（例如 "t40"），
          // 则查询该基础芯片名称以及所有 ?o=0 到 ?o=7 的变体
          const devicesToSearch: string[] = [input.device]; // 包含基础芯片
          for (let i = 0; i <= 7; i++) {
            devicesToSearch.push(`${input.device}?o=${i}`);
          }
          // 使用原始 SQL 表达式和 JSON_EXTRACT 配合 IN 操作符
          qb.andWhere("JSON_EXTRACT(qj.info, '$.device') IN (?)", [devicesToSearch]);
        }
      }

      const jobs = await qb.getResultList();

      // 从数据库中返回
      return {
        tasks: jobs.sort((a, b) => {
          const timeDiff = b.submitTime.getTime() - a.submitTime.getTime();
          if (timeDiff === 0) {
            return b.id - a.id;
          }
          return timeDiff;
        }).map((job) => FindTaskSchema.parse({
          ...job.info,
          jobId: job.id,
          submitTime: new Date(job.submitTime.getTime()).toString(),
          lastSyncTime: job.lastSyncTime,
          account: job.accountName,
          duration: calculateDuration(job.info.ts),
          qits: job.qits,
        })),
      };
    }),

  getTaskDetail: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/detail",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(z.object({
      task: GetTaskDetailSchema,
    }))
    .query(async ({ input, ctx: { user, orm } }) => {

      const task = await orm.em.fork().findOne(QuantumJob, {
        userId: user.identityId,
        jobId: input.id,
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Task with ID ${input.id} not found for user ${user.identityId}`,
        });
      }

      return {
        task: GetTaskDetailSchema.parse({
          ...task.info,
          jobId: task.id,
          submitTime: new Date(task.submitTime.getTime()).toString(),
          account: "", // 这里后续加上账户信息
          duration: calculateDuration(task.info.ts),
          qits: task.qits,
        }),
      };
    }),

  startTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/start",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(SubmitTaskResponseSchema)
    .mutation(async ({ input, ctx: { orm, user } }) => {

      const userAccountPermission = await checkUserAccountPermission(user.identityId, input.accountName);

      if (!userAccountPermission) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This account ${input.accountName} is currently unavailable to the user ${user.identityId}. `,
        });
      }

      const task = await orm.em.fork().findOne(QuantumJob, {
        userId: user.identityId,
        jobId: input.id,
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Task with ID ${input.id} not found for user ${user.identityId}`,
        });
      }

      checkDeviceAvailability(task.info.device);

      const { accountName } = input;

      const accountInfo = await getAccountInfo(accountName);

      const isAccountCanAfford = await estimateAccountCanAfford(accountInfo,[{
        source: task.info.source,
        shots: task.info.shots,
        device: task.info.device,
      }]);

      if (!isAccountCanAfford) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `The account ${accountName} does not have enough balance to run this task. `,
        });
      }

      const resp = await callBackendApi("/task/start", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }

      return handleSubmitTaskRecord(b, orm, user, accountName, accountInfo.tenantName);
    }),

  stopTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/stop",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(SubmitTaskResponseSchema)
    .mutation(async ({ input, ctx: { user } }) => {

      const userAccountPermission = await checkUserAccountPermission(user.identityId, input.accountName);

      if (!userAccountPermission) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This account ${input.accountName} is currently unavailable to the user ${user.identityId}. `,
        });
      }

      const resp = await callBackendApi("/task/stop", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }
      return b.data;
    }),

  removeTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/remove",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(SubmitTaskResponseSchema)
    .mutation(async ({ input, ctx: { user } }) => {

      const userAccountPermission = await checkUserAccountPermission(user.identityId, input.accountName);

      if (!userAccountPermission) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This account ${input.accountName} is currently unavailable to the user ${user.identityId}. `,
        });
      }

      const resp = await callBackendApi("/task/remove", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }
      return b.data;
    }),

  getTaskStatus: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/status",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(SubmitTaskResponseSchema)
    .query(async ({ input }) => {
      const resp = await callBackendApi("/task/status", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }
      return b.data;
    }),

  getTaskBill: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/bill",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(SubmitTaskResponseSchema)
    .query(async ({ input, ctx: { user } }) => {

      const userAccountPermission = await checkUserAccountPermission(user.identityId, input.accountName);

      if (!userAccountPermission) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This account ${input.accountName} is currently unavailable to the user ${user.identityId}. `,
        });
      }

      const resp = await callBackendApi("/task/bill", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = SubmitTaskResponseSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }
      return b.data;
    }),

  getTaskResult: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/result",
      },
    })
    .input(z.object({
      accountName: z.string(),
      id: z.string(),
    }))
    .output(GetTaskResultSchema)
    .query(async ({ input }) => {
      const resp = await callBackendApi("/task/result", {
        method: "POST",
        body: JSON.stringify(input.id),
      });

      const b = GetTaskResultSchema.safeParse(resp);
      if (!b.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${b.error.message}`,
        });
      }
      return b.data;
    }),

  estimateTask: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/task/estimate",
      },
    })
    .input(z.object({
      accountName: z.string(),
      device: z.string().optional(),
      tasks: z.array(z.object({
        device: z.string().optional(),
        qubits: z.number(),
        shots: z.number(),
      })),
    }))
    .output(EstimateTaskSchema)
    .mutation(async ({ input }) => {

      if (input.device) {
        checkDeviceAvailability(input.device);
      }

      const resp = await callBackendApi("/task/estimate", {
        method: "POST",
        body: JSON.stringify(input),
      });

      const parsed = EstimateTaskSchema.safeParse(resp);
      if (!parsed.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Invalid response from Backend API: ${parsed.error.message}`,
        });
      }

      return parsed.data;
    }),


});
