"use client";

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { useRouter } from "next/navigation";
import { join } from "path";
import { use,useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { defaultClusterContext } from "src/app/(auth)/defaultClusterContext";
import { FileManager } from "src/app/(auth)/files/FileManager";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";
import { Head } from "src/utils/head";
import { trpc } from "src/utils/trpc";

export default function Page({ params }: { params: Promise<{
  resourceId: string; path: string[] }> }) {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.pages.");

  const router = useRouter();

  const { clusters, publicConfig: { LOGIN_NODES,CLUSTERS },currentAssociateClusterIds } = usePublicConfig();

  const { defaultCluster, currentClusters }
     = defaultClusterContext(CLUSTERS, currentAssociateClusterIds ?? []);
  const initialClusterId = defaultCluster?.id ?? currentClusters[0].id;
  const [clusterId, setClusterId] = useState(initialClusterId);

  const { path: pathParts = []} = use(params);

  const decodePathParts = useMemo(() => {
    return pathParts.map((path) => decodeURIComponent(path));
  }, [pathParts]);

  const fullPath = (decodePathParts && decodePathParts.length === 1 && decodePathParts[0] === "~")
    ? "~"
    : "/" + (decodePathParts?.join("/") ?? "");

  const homeDirPathQuery = trpc.file.getHomeDir.useQuery({
    clusterId,
  }, {
    enabled: fullPath === "~",
    onSuccess: ({ path }) => {
      if (decodePathParts && decodePathParts.length === 1 && decodePathParts[0] === "~") {
        router.push(join("/files", path));
      }
    },
  });

  // if cluster changes and accesses homedir, find the homedir and go to it
  useEffect(() => {
    homeDirPathQuery.refetch();
  }, [fullPath]);

  const clusterObj = clusters.find((x) => x.id === clusterId);

  const i18n = useI18n();

  const i18nClusterName = getI18nConfigCurrentText(clusterObj?.name ?? clusterId, i18n.currentLanguage.id);

  return (
    <>
      <Head title={`${i18nClusterName} ${t(p("fileManage"))}`} />
      {
        clusterObj ? (
          <FileManager
            cluster={clusterObj}
            setClusterId={setClusterId}
            loginNodes={LOGIN_NODES}
            path={fullPath}
            urlPrefix="/files"
          />
        ) : (
          <NotFoundPage />
        )
      }
    </>
  );
}
