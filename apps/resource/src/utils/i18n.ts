import { Cluster } from "@scow/config/build/type";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { deepMerge } from "react-typed-i18n";
import { I18nDicType, languageDic, optionalLanguageDic } from "src/models/i18n";

const fallbackLanguage = languageDic.en;

export const getLanguage = (languageId: string | undefined | null): I18nDicType => {
  if (!languageId) {
    languageId = "zh_cn";
  }

  const optionalLanguage = optionalLanguageDic[languageId];

  if (optionalLanguage) {
    return deepMerge(fallbackLanguage, optionalLanguage);
  }

  return languageDic[languageId] ?? languageDic.zh_cn;
};

export type I18nDicKeys = keyof I18nDicType;

export const getCurrentClusterI18nName = (clusterId: string, languageId: string, currentClusterData?: Cluster[]) => {
  const clusterName = currentClusterData?.find((x) => x.id === clusterId)?.name;
  return clusterName ? getI18nConfigCurrentText(clusterName, languageId) : clusterId;
};
