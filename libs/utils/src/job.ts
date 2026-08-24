export const jobStates = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "TIMEOUT",
  "NODE_FAIL",
  "SUSPENDED",
] as const;

export type JobState = (typeof jobStates)[number];

export const isJobState = (state: string): state is JobState => jobStates.includes(state as JobState);
