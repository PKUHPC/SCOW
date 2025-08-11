/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

"use client";

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { FileManager } from "src/app/(auth)/files/FileManager";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";
import { Head } from "src/utils/head";
import { trpc } from "src/utils/trpc";

export default function Page({ params }: { params: { cluster: string; resourceId: string; path: string[] } }) {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.pages.");

  const router = useRouter();

  const { cluster, path: pathParts = []} = params;

  const decodePathParts = useMemo(() => {
    return pathParts.map((path) => decodeURIComponent(path));
  }, [pathParts]);

  const { clusters, publicConfig: { LOGIN_NODES } } = usePublicConfig();

  const fullPath = (decodePathParts && decodePathParts.length === 1 && decodePathParts[0] === "~")
    ? "~"
    : "/" + (decodePathParts?.join("/") ?? "");

  const homeDirPathQuery = trpc.file.getHomeDir.useQuery({
    clusterId: cluster,
  }, {
    enabled: fullPath === "~",
    onSuccess: ({ path }) => {
      if (decodePathParts && decodePathParts.length === 1 && decodePathParts[0] === "~") {
        router.push(join("/files", cluster, path));
      }
    },
  });

  // if cluster changes and accesses homedir, find the homedir and go to it
  useEffect(() => {
    homeDirPathQuery.refetch();
  }, [fullPath]);

  const clusterObj = clusters.find((x) => x.id === cluster);

  const i18n = useI18n();

  const i18nClusterName = getI18nConfigCurrentText(clusterObj?.name ?? cluster, i18n.currentLanguage.id);

  return (
    <>
      <Head title={`${i18nClusterName} ${t(p("fileManage"))}`} />
      {
        clusterObj ? (
          <FileManager
            cluster={clusterObj}
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
