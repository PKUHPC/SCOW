import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { LockMode, MikroORM } from "@mikro-orm/mysql";
import { parsePlaceholder } from "@scow/lib-config";
import { Decimal, numberToMoney } from "@scow/lib-decimal";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { DetailTaskSchema, EstimateTaskSchema } from "src/models/task";
import { quantumConfig } from "src/server/config/quantum";
import { QuantumJob } from "src/server/entities/QuantumJob";
import { callBackendApi } from "src/server/trpc/route/backend/common";
import { getORM } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { getMisClient } from "src/utils/client";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

const responseSchema = z.object({
  task: DetailTaskSchema,
});

export function createJobManager(orm: MikroORM) {
  // 同步一次数据库中没有完成的作业

  const syncJobs = async (signal: AbortSignal) => {
    while (!signal.aborted) {
      const em = orm.em.fork();
      await em.transactional(async (em) => {

        const jobs = await em.find(QuantumJob, {
          info: { state: { $nin: ["completed", "failed"]} },
          lastSyncTime: { $lt: new Date(Date.now() - 5 * 1000) }, // 只同步超过5秒未同步的作业
        }, {
          lockMode: LockMode.PESSIMISTIC_WRITE,
          orderBy: { lastSyncTime: "ASC" },
          limit: 10, // 限制每次同步的作业数量
        });

        if (jobs.length === 0) {
          return;
        }

        await Promise.all(jobs.map(async (job) => {
          try {
            // 调用量子云平台API获取作业状态
            const resp = await callBackendApi("/task/detail", {
              method: "POST",
              body: JSON.stringify({ id: job.jobId }),
              signal: signal,
            });

            const data = responseSchema.safeParse(resp);
            if (!data.success) {
              logger.error(`Invalid response for job ${job.id}:`, data.error);
              return;
            }

            // 更新作业状态
            job.info = data.data.task;
            job.state = data.data.task.state;
            job.lastSyncTime = new Date();
            await em.persistAndFlush(job);

            if (!USE_MOCK && (job.state === "completed" || job.state === "failed")) {

              // 如果作业已完成或失败，计费

              const estimateResp = await callBackendApi("/task/estimate", {
                method: "POST",
                body: JSON.stringify({
                  tasks:
                    [{
                      qubits: job.info.qubits,
                      shots: job.info.shots,
                      device: job.info.device,
                    }],
                }),
              });

              const estimateData = EstimateTaskSchema.safeParse(estimateResp);

              if (!estimateData.success) {
                logger.error(`Invalid estimate response for job ${job.id}:`, estimateData.error);
                return;
              }

              const MIN_BALANCE = 50;

              const balance = estimateData.data.balance ? estimateData.data.balance * 1e-6 : undefined;

              if (balance && balance < MIN_BALANCE) {
                logger.warn("Not enough balance for job", balance);
              }

              const client = getMisClient(ChargingServiceClient);

              const qits = new Decimal(estimateData.data.qits);

              const amountHighPrecision = qits.times("0.000001").times("0.5");

              const amount = numberToMoney(amountHighPrecision.toNumber());

              if (job.state === "completed") {

                const comment = parsePlaceholder(quantumConfig.taskChargeComment, job);

                // 账户扣费
                await asyncUnaryCall(client, "charge", {
                  userId: job.userId,
                  tenantName: job.tenantName,
                  accountName: job.accountName,
                  type: quantumConfig.taskChargeType,
                  amount: amount,
                  comment,
                  metadata: { quantumJobId: job.jobId },
                });

                // 租户扣费
                await asyncUnaryCall(client, "charge", {
                  userId: job.userId,
                  tenantName: job.tenantName,
                  type: quantumConfig.taskChargeType,
                  amount: amount,
                  comment,
                  metadata: { quantumJobId: job.jobId },
                });
              }

            }

            console.log(`Job ${job.id} synced successfully.`);
          } catch (error) {
            console.error(`Failed to sync job ${job.id}:`, error);
          }
        }));
      }).catch((e) => {
        console.error("Transaction failed:", e);
      });

      await new Promise((resolve) => {
        // 等待10秒后再进行下一次同步
        setTimeout(resolve, 10 * 1000);
      });
    }
  };

  let abortController = new AbortController();

  return {
    syncJobs,
    startSync: () => {
      if (abortController.signal.aborted) {
        abortController = new AbortController();
      }
      syncJobs(abortController.signal).catch((error) => {
        console.error("Error during job sync:", error);
      });
    },
    stopSync: () => {
      abortController.abort();
    },
  };
}

let jobManager: ReturnType<typeof createJobManager> | null = null;

export async function initializeJobManager() {
  if (jobManager) {
    console.warn("Job manager is already initialized.");
    return jobManager;
  }

  const orm = await getORM();
  jobManager = createJobManager(orm);
  console.log("Quantum job manager initialized. Starting job sync...");
  jobManager.startSync();
  return jobManager;
}

