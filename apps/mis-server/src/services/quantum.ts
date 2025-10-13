import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server"; ;
import { SortOrder } from "@scow/protos/build/common/sort_order";
import {
  GetQuantumJobsRequest_SortBy as SortBy,
  QuantumJobState, QuantumServiceServer, QuantumServiceService,
} from "@scow/protos/build/server/quantum";
import { TRPCClientError } from "@trpc/client";
import { createQuantumClient } from "src/clients/quantum";

const stringToJobStateMap: Record<string, QuantumJobState> = {
  "scheduled": QuantumJobState.SCHEDULED,
  "pending": QuantumJobState.PENDING,
  "active": QuantumJobState.ACTIVE,
  "completed": QuantumJobState.COMPLETED,
  "failed": QuantumJobState.FAILED,
  "hold": QuantumJobState.HOLD,
};

const sortByMap: Record<number, string> = {
  [SortBy.JOB_ID]: "jobId",
  [SortBy.ACCOUNT]: "accountName",
  [SortBy.USER]: "userId",
  [SortBy.SUBMIT_TIME]: "submitTime",
  [SortBy.LAST_SYNC_TIME]: "lastSyncTime",
  [SortBy.QITS]: "qits",
  [SortBy.AMOUNT]: "amount",
  [SortBy.SHOTS]: "shots",
  [SortBy.DEVICE]: "device",
  [SortBy.QUBITS]: "qubits",
  [SortBy.STATE]: "state",
  // [SortBy.DURATION]: "duration",
};

const sortOrderMap: Record<number, "asc" | "desc"> = {
  [SortOrder.ASCEND]: "asc",
  [SortOrder.DESCEND]: "desc",
};

export const quantumServiceServer = plugin((server) => {

  server.addService<QuantumServiceServer>(QuantumServiceService, {

    getQuantumJobs: async ({ request, logger }) => {

      const { userToken, filter, page, pageSize, sortBy, sortOrder } =
        ensureNotUndefined(request, ["filter"]);

      const { accountName, tenantName, userId, jobId, qubits, shots } = filter;

      try {
        const client = createQuantumClient(userToken);

        const { tasks, totalCount } = await client.backend.task.findTask.query({
          accountName: (accountName?.trim() && accountName.trim() !== "") ?
            accountName.trim() : "_",
          page,
          pageSize: pageSize ?? 10,
          id: jobId,
          qubits,
          shots,
          tenantName,
          userId,
          states: ["completed", "failed"],
          ...(sortBy && sortOrder !== undefined && {
            sortBy: sortByMap[sortBy],
            sortOrder: sortOrderMap[sortOrder],
          }),
        });

        const jobs = tasks.map((task) => ({
          ...task,
          lastSyncTime: task.lastSyncTime.toISOString(),
          qits: task.qits?.toString(),
          amount: task.amount?.toString(),
          state: stringToJobStateMap[task.state],
        }));

        return [{
          jobs,
          totalCount,
        }];
      }
      catch (e) {
        logger.error("Error caught:", e);
        if (e instanceof TRPCClientError) {
          if (e.message.includes("ENOTFOUND")) {
            logger.error("Could not resolve Quantum API server address.");
            throw new Error("Could not connect to Quantum API server. Please check configuration.");
          }
        }
        throw e;
      }
    },
  });
});
