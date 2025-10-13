import { Static, Type } from "@sinclair/typebox";

export const JobSortBy = Type.Union([
  Type.Literal("jobId"),
  Type.Literal("account"),
  Type.Literal("user"),
  Type.Literal("submitTime"),
  Type.Literal("lastSyncTime"),
  Type.Literal("qits"),
  Type.Literal("amount"),
  // Type.Literal("duration"),
  Type.Literal("shots"),
  Type.Literal("device"),
  Type.Literal("qubits"),
  Type.Literal("state"),
]);

export type JobSortBy = Static<typeof JobSortBy>;
