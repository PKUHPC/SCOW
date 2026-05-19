import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Spin } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { join } from "path";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { ServerErrorPage } from "src/components/errorPages/ServerErrorPage";
import { Redirect } from "src/components/Redirect";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";

export const HomeDirFileManagerPage: NextPage = requireAuth(() => true)(() => {
  const router = useRouter();

  const cluster = queryToString(router.query.cluster);

  const { currentClusters } = useStore(ClusterInfoStore);
  if (!currentClusters.find((x) => x.id === cluster)) {
    return <ClusterNotAvailablePage />;
  }

  const { data, isLoading, error } = useAsync({
    promiseFn: useCallback(async () => api.getHomeDirectory({ query: { cluster } }), [cluster]),
  });

  if (isLoading) {
    return <Spin />;
  }

  if (error) {
    return <ServerErrorPage />;
  }

  return <Redirect url={join("/files", cluster, data?.path ?? "")} />;
});

export default HomeDirFileManagerPage;
