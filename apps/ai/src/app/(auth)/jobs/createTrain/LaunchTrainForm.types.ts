import type { FrameworkType } from "src/server/trpc/route/jobs/jobs";

import type {
  AppFormValues,
  ImageSourceKey,
  ResourceFormValues as BaseResourceFormValues,
} from "../createApp/[appId]/LaunchAppForm.types";

export type TrainImageSourceKey = Exclude<ImageSourceKey, "preset">;
export type TrainFramework = "single" | FrameworkType;

export interface TrainAppFormValues extends AppFormValues {
  needTensorBoard?: boolean;
  tensorBoardDataPath?: string;
}

export interface ResourceFormValues extends BaseResourceFormValues {
  framework?: TrainFramework;
  nodeUnitCount?: number;
  psNodeCount?: number;
  workerNodeCount?: number;
  distributedNodeCount?: number;
}

export * from "../createApp/[appId]/LaunchAppForm.types";
