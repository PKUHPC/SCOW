import type {
  ImageSourceKey,
  ResourceFormValues as BaseResourceFormValues,
} from "../createApp/[appId]/LaunchAppForm.types";

export type TrainImageSourceKey = Exclude<ImageSourceKey, "preset">;
export interface ResourceFormValues extends BaseResourceFormValues {
  nodeCount?: number;
  maxTimeUnlimited?: boolean;
}

export * from "../createApp/[appId]/LaunchAppForm.types";
