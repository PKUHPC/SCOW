import { TRPCError } from "@trpc/server";

export enum AIJobLabelType {
  app = "app",
  train = "train",
  infer = "infer",
  devHost = "devHost",
}
// 后端校验是否超出已配置的最长运行时间
export function validateMaxRunningTimeMinutes(
  maxTimeMinutes: number,
  maxRunningTimeHours: number | undefined,
  jobLabel: AIJobLabelType,
) {
  if (maxTimeMinutes <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The ${jobLabel} running time must be greater than 0`,
    });
  }

  if (maxRunningTimeHours === undefined) {
    return;
  }

  if (maxTimeMinutes > maxRunningTimeHours * 60) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `The ${jobLabel} running time cannot exceed ${maxRunningTimeHours}` +
        ` hour${maxRunningTimeHours > 1 ? "s" : ""}`,
    });
  }
}
