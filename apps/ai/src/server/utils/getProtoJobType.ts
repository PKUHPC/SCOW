import { JobType as ProtoJobType } from "@scow/scheduler-adapter-protos/build/job";
import { JobType } from "src/models/Job";


export function getProtoJobType(jobType: JobType | undefined) {
  switch (jobType) {
    case JobType.APP:
      return ProtoJobType.JOB_TYPE_APP;
    case JobType.TRAIN:
      return ProtoJobType.JOB_TYPE_TRAIN;
    case JobType.INFER:
      return ProtoJobType.JOB_TYPE_INFER;
    case JobType.DEV_HOST:
      return ProtoJobType.JOB_TYPE_DEV_HOST;
    default:
      return ProtoJobType.JOB_TYPE_UNSPECIFIED;
  }
}

export function getProtoJobTypes(jobTypes: JobType[]): ProtoJobType[] {
  return jobTypes.map((jobType) => {
    switch (jobType) {
      case JobType.APP:
        return ProtoJobType.JOB_TYPE_APP;
      case JobType.TRAIN:
        return ProtoJobType.JOB_TYPE_TRAIN;
      case JobType.INFER:
        return ProtoJobType.JOB_TYPE_INFER;
      case JobType.DEV_HOST:
        return ProtoJobType.JOB_TYPE_DEV_HOST;
      default:
        return ProtoJobType.JOB_TYPE_UNSPECIFIED;
    }
  });
}
