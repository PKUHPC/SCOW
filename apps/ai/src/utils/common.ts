import { AIPodReason } from "@scow/lib-web/build/utils/jobExceptionReason";
import { TextId } from "src/i18n";
import { SharedStatus } from "src/models/common";

export const getSharedStatusText = (status: SharedStatus): "share" | "cancelShare" | "cancelSharing" | "sharing" => {
  switch (status) {
    case SharedStatus.SHARED:
      return "cancelShare";

    case SharedStatus.UNSHARING:
      return "cancelSharing";

    case SharedStatus.SHARING:
      return "sharing";

    default:
      return "share";
  }
};

export const getSharedStatusUpperText = (
  status: SharedStatus,
): "upperShare" | "upperCancelShare" | "upperCancelSharing" | "upperSharing" => {
  switch (status) {
    case SharedStatus.SHARED:
      return "upperCancelShare";

    case SharedStatus.UNSHARING:
      return "upperCancelSharing";

    case SharedStatus.SHARING:
      return "upperSharing";

    default:
      return "upperShare";
  }
};

type AIJobExceptionReasonLangKey = TextId & `common.aiJobExceptionReason.${string}`;
export const JobReasonI18nKeyMap: Record<string, AIJobExceptionReasonLangKey> = {
  [AIPodReason.IMAGE_PULL_ERROR]: "common.aiJobExceptionReason.imagePullError",
  [AIPodReason.MOUNT_ERROR]: "common.aiJobExceptionReason.mountError",
  [AIPodReason.RESTART_ERROR]: "common.aiJobExceptionReason.restartError",
  [AIPodReason.SCHEDULING_ERROR]: "common.aiJobExceptionReason.schedulingError",
  [AIPodReason.IMAGE_PULLING]: "common.aiJobExceptionReason.imagePulling",
  [AIPodReason.INSUFFICIENT_RESOURCES]: "common.aiJobExceptionReason.insufficientResources",
};

export const getPublishStatusText = (
  status: SharedStatus,
): "publish" | "cancelPublish" | "cancelPublishing" | "publishing" => {
  switch (status) {
    case SharedStatus.SHARED:
      return "cancelPublish";

    case SharedStatus.UNSHARING:
      return "cancelPublishing";

    case SharedStatus.SHARING:
      return "publishing";

    default:
      return "publish";
  }
};

export const getPublishStatusUpperText = (
  status: SharedStatus,
): "upperPublish" | "upperCancelPublish" | "upperCancelPublishing" | "upperPublishing" => {
  switch (status) {
    case SharedStatus.SHARED:
      return "upperCancelPublish";

    case SharedStatus.UNSHARING:
      return "upperCancelPublishing";

    case SharedStatus.SHARING:
      return "upperPublishing";

    default:
      return "upperPublish";
  }
};

export const transformPublishStatusText = (
  status: SharedStatus,
): "PUBLISHED" | "UNPUBLISHED" | "PUBLISHING" | "UNPUBLISHING" => {
  switch (status) {
    case SharedStatus.SHARED:
      return "PUBLISHED";

    case SharedStatus.UNSHARING:
      return "UNPUBLISHING";

    case SharedStatus.SHARING:
      return "PUBLISHING";

    default:
      return "UNPUBLISHED";
  }
};

export const statusColors: Record<SharedStatus, string> = {
  UNSHARED: "#6A6A6A",
  SHARED: "#3584D9",
  SHARING: "#46B600",
  UNSHARING: "#A1A1A1",
};
