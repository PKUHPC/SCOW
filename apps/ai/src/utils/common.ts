import { AIPodReason } from "@scow/lib-web/build/utils/jobExceptionReason";
import { TextId } from "src/i18n";
import { SharedStatus } from "src/models/common";


export const getSharedStatusText = (status: SharedStatus):
"share" | "cancelShare" | "cancelSharing" | "sharing" => {
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

export const getSharedStatusUpperText = (status: SharedStatus):
"upperShare" | "upperCancelShare" | "upperCancelSharing" | "upperSharing" => {
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
