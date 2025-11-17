import { AIPodReason } from "@scow/lib-web/build/utils/jobExceptionReason";
import { Lang } from "react-typed-i18n";
import { TextId } from "src/i18n";
import en from "src/i18n/en";
import { getRuntimeI18nConfigText, publicConfig } from "src/utils/config";

export const passwordRule = (languageId: string) => {
  return {
    pattern: publicConfig.PASSWORD_PATTERN ? new RegExp(publicConfig.PASSWORD_PATTERN) : undefined,
    message: getRuntimeI18nConfigText(languageId, "passwordPatternMessage"),
  };
};


export { confirmPasswordFormItemProps, getEmailRule } from "@scow/lib-web/build/utils/form";


type AIJobExceptionReasonLangKey = TextId & `common.aiJobExceptionReason.${string}`;
const JobReasonI18nKeyMap: Record<string, AIJobExceptionReasonLangKey> = {
  [AIPodReason.IMAGE_PULL_ERROR]: "common.aiJobExceptionReason.imagePullError",
  [AIPodReason.MOUNT_ERROR]: "common.aiJobExceptionReason.mountError",
  [AIPodReason.RESTART_ERROR]: "common.aiJobExceptionReason.restartError",
  [AIPodReason.SCHEDULING_ERROR]: "common.aiJobExceptionReason.schedulingError",
  [AIPodReason.IMAGE_PULLING]: "common.aiJobExceptionReason.imagePulling",
  [AIPodReason.INSUFFICIENT_RESOURCES]: "common.aiJobExceptionReason.insufficientResources",
};

type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;
export const getAiExceptionJobI18nReason = (originalReason: string, t: TransType): string => {
  const i18nKey = JobReasonI18nKeyMap[originalReason.toUpperCase()];
  return i18nKey !== undefined ? t(i18nKey as TextId) : originalReason;
};
