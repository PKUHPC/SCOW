import type {
  ImageSourceKey,
  ResourceFormValues as BaseResourceFormValues,
} from "../LaunchJobForm.types";

export type InferImageSourceKey = Exclude<ImageSourceKey, "preset">;
export interface ResourceFormValues extends BaseResourceFormValues {
  nodeCount?: number;
  maxTimeUnlimited?: boolean;
}

export * from "../LaunchJobForm.types";
