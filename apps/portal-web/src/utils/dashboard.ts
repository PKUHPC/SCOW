import { Cluster } from "@scow/config/build/type";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Entry } from "@scow/protos/build/portal/dashboard";
import { type useI18nTranslateToString } from "src/i18n";
import { AppWithCluster } from "src/pageComponents/dashboard/QuickEntry";

export const formatEntryId = (item: Entry) => {

  if (item.entry?.$case === "app") {
    return `${item.id}-${item.entry.app.clusterId}`;
  }

  else if (item.entry?.$case === "shell") {
    return `${item.id}-${item.entry.shell.clusterId}`;
  }

  return item.id;
};

export const getEntryIcon = (item: Entry) => {

  if (item.entry?.$case === "pageLink") {
    return item.entry.pageLink.icon;
  }

  else if (item.entry?.$case === "shell") {
    return item.entry.shell.icon;
  }
  return undefined;
};

export const entryNameMap = {
  submitJob:"routes.job.submitJob",
  runningJobs:"routes.job.runningJobs",
  allJobs:"routes.job.allJobs",
  savedJobs:"routes.job.jobTemplates",
  loginCluster:"routes.loginCluster",
} as const;

export const getEntryBaseName = (item: Entry, t: ReturnType<typeof useI18nTranslateToString>) => {
  const entry = item.entry;

  if (!entry) { return ""; }

  if (entry.$case === "pageLink" && entryNameMap[item.name]) {
    return t(entryNameMap[item.name]);
  }

  return item.name;
};

export const getEntryExtraInfo = (item: Entry, currentLanguageId: string, publicConfigClusters: Cluster[]) => {
  const entry = item.entry;

  if (!entry) { return []; }


  if (entry.$case === "app") {
    const clusterName = getI18nConfigCurrentText(getEntryClusterName(entry, publicConfigClusters), currentLanguageId);
    return [clusterName];
  }

  if (entry.$case === "shell") {
    const clusterName = getI18nConfigCurrentText(getEntryClusterName(entry, publicConfigClusters), currentLanguageId);
    return [clusterName, entry.shell.loginNode];
  }

  return [];
};

export const getEntryClusterName = (item: Entry["entry"] & { $case: "app" | "shell" }
  , publicConfigClusters: Cluster[]) => {
  const clusters = publicConfigClusters;

  if (item.$case === "shell") {
    const clusterId = item.shell.clusterId;
    return clusters.find((x) => x.id === clusterId)?.name;
  }

  const clusterId = item.app.clusterId;
  return clusters.find((x) => x.id === clusterId)?.name;

};

export const getEntryLogoPath = (item: Entry, apps: AppWithCluster) => {

  if (item.entry?.$case === "app") {
    const appId = item.entry.app.appId;

    return apps[appId] ? apps[appId].app.logoPath : undefined;
  }

  return undefined;
};
