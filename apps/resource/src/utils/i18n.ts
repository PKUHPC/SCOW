import { Cluster } from "@scow/config/build/type";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { I18nDicType, languageDic } from "src/models/i18n";

export const getLanguage = (languageId: string | undefined | null): I18nDicType => {
  const languages = ((languageId && languageId in languageDic)
    ? languageDic[languageId as keyof typeof languageDic]
    : undefined
  ) ?? languageDic.zh_cn;
  return languages;
};

export type I18nDicKeys = keyof I18nDicType;


export const getCurrentClusterI18nName = (clusterId: string, languageId: string, currentClusterData?: Cluster[]) => {
  const clusterName = currentClusterData?.find((x) => x.id === clusterId)?.name;
  return clusterName ? getI18nConfigCurrentText(clusterName, languageId) : clusterId;
};
