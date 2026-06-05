import { ServiceError, status } from "@grpc/grpc-js";
import { TimeUnit } from "@scow/protos/build/portal/job";

const MINUTES_PER_HOUR = 60;

const TIME_UNIT_TO_MINUTES: Record<TimeUnit, number> = {
  [TimeUnit.MINUTES]: 1,
  [TimeUnit.HOURS]: 60,
  [TimeUnit.DAYS]: 24 * 60,
};

export function convertMaxTimeToMinutes(maxTime: number, maxTimeUnit: TimeUnit | undefined): number {
  return maxTime * TIME_UNIT_TO_MINUTES[maxTimeUnit ?? TimeUnit.MINUTES];
}

export enum HPCJobLabelType {
  app = "app",
  job = "job",
}
export function validateMaxRunningTimeMinutes(
  maxTimeMinutes: number,
  maxRunningTimeHours: number | undefined,
  jobLabel: HPCJobLabelType,
) {
  if (maxTimeMinutes <= 0) {
    throw {
      code: status.INVALID_ARGUMENT,
      message: `The ${jobLabel} running time must be greater than 0`,
    } as ServiceError;
  }

  if (maxRunningTimeHours === undefined) {
    return;
  }

  if (maxTimeMinutes > maxRunningTimeHours * MINUTES_PER_HOUR) {
    throw {
      code: status.INVALID_ARGUMENT,
      message:
        `The ${jobLabel} running time cannot exceed ${maxRunningTimeHours}` +
        ` hour${maxRunningTimeHours > 1 ? "s" : ""}`,
    } as ServiceError;
  }
}
