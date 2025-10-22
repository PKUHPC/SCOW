import { Cluster } from "@scow/config/build/type";
import { SortOrder } from "antd/lib/table/interface";
import { Entry } from "src/components/quickEntry";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { getI18nConfigCurrentText } from "src/utils/systemLanguage";

export interface App { id: string; name: string; logoPath?: string; };

export type AppWithCluster = Record<string, {
  app: App;
  clusters: Cluster[];
}>;

export const formatEntryId = (item: Entry) => {

  if (item.entry?.$case === "app") {
    return `${item.id}-${item.entry.app.clusterId}`;
  }

  else if (item.entry?.$case === "shell") {
    return `${item.id}-${item.entry.shell.clusterId}`;
  }
  else if (item.entry?.$case === "clusterPageLink") {
    return `${item.id}-${item.entry.clusterPageLink.clusterId}`;
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
  else if (item.entry?.$case === "clusterPageLink") {
    return item.entry.clusterPageLink.icon;
  }
  return undefined;
};

export const entryNameMap = {
  // hpc
  submitJob:"submitJob",
  runningJobs:"runningJobs",
  allJobs:"allJobs",
  savedJobs:"jobTemplates",
  desktop:"desktop",
  appSessions: "appSessions",
  fileManage: "fileManage",

  // ai
  privateDataset: "privateDataset",
  publicDataset: "publicDataset",
  privateImage: "privateImage",
  publicImage: "publicImage",
  privateAlgorithm: "privateAlgorithm",
  publicAlgorithm: "publicAlgorithm",
  privateModel: "privateModel",
  publicModel: "publicModel",
  file: "file",
  app: "app",
  trainJobs: "trainJobs",
  historyJobs: "historyJobs",
  inference: "inference",
} as const;

export const getEntryBaseName = (item: Entry, languageId) => {
  const entry = item.entry;

  if (!entry) { return ""; }

  if ((entry.$case === "pageLink" || entry.$case === "clusterPageLink") && entryNameMap[item.name]) {
    return getCurrentLangLibWebText(languageId, entryNameMap[item.name]) || "";
  }

  return item.name;
};

export const getEntryExtraInfo = (item: Entry, currentLanguageId: string, publicConfigClusters: Cluster[]) => {
  const entry = item.entry;

  if (!entry) { return []; }


  if (entry.$case === "app" || entry.$case === "clusterPageLink") {
    const clusterName = getI18nConfigCurrentText(getEntryClusterName(entry, publicConfigClusters), currentLanguageId);
    return [clusterName];
  }

  if (entry.$case === "shell") {
    const clusterName = getI18nConfigCurrentText(getEntryClusterName(entry, publicConfigClusters), currentLanguageId);
    return [clusterName, entry.shell.loginNode];
  }

  return [];
};

export const getEntryClusterName = (item: Entry["entry"] & { $case: "app" | "shell" | "clusterPageLink" }
  , publicConfigClusters: Cluster[]) => {
  const clusters = publicConfigClusters;

  if (item.$case === "shell") {
    const clusterId = item.shell.clusterId;
    return clusters.find((x) => x.id === clusterId)?.name;
  }

  if (item.$case === "clusterPageLink") {
    const clusterId = item.clusterPageLink.clusterId;
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

export const compareWithUndefined = <T extends number | string | undefined>
(a: T, b: T, sortOrder?: SortOrder): number => {
  if (a === undefined && b === undefined) {
    // 两者均为 undefined，视为相等
    return 0;
  }
  else if (a === undefined) {
    // a 为 undefined，b 不为 undefined，将 a 排在后面
    return sortOrder === "ascend" || !sortOrder ? 1 : -1;
  }
  else if (b === undefined) {
    // b 为 undefined，a 不为 undefined，将 b 排在后面
    return sortOrder === "ascend" || !sortOrder ? -1 : 1;
  }

  // 都不为 undefined 时，正常比较
  return typeof a === "number" && typeof b === "number" ? a - b :
    typeof a === "string" && typeof b === "string" ? a.localeCompare(b) :
      0;
};
