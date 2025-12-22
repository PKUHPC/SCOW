import { Cluster } from "@scow/config/build/type";
import { Entry } from "@scow/protos/build/portal/dashboard";

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
