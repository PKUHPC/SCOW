export enum JobType {
  APP = "app",
  TRAIN = "train",
  INFER = "infer",
  DEV_HOST = "dev_host",
}

export const UNKNOWN_JOB_TYPE = "-";

export enum ImageSource {
  DEFAULT = "default",
  LOCAL = "local",
  REMOTE = "remote",
}

export const statusColors: Record<string, string> = {
  RUNNING: "#46B600",
  PENDING: "#B0B600",
  COMPLETED: "#3584D9",
  FAILED: "#D93566",
  CANCELED: "#A1A1A1",
  TIMEOUT: "#5FBDEC",
  ENDED: "#6A6A6A",
  QUEUED: "#F56B2F",
  // AI POD相关其他特殊Status
  UNKNOWN: "#6A6A6A",
  SUCCEEDED: "#3584D9",
  CONTAINER_CREATING: "#F5A800",
};
