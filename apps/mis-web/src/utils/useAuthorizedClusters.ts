import type { FormInstance } from "antd";
import type { Dispatch, SetStateAction } from "react";
import type { Cluster } from "src/utils/cluster";

import { useEffect, useState } from "react";

interface FilterFormWithClusters {
  clusters: Cluster[];
}

/**
 * 获取授权集群 ID 列表，并自动过滤表单与查询状态中不在授权范围内的集群。
 *
 * @param fetchFn 获取授权集群 ID 的异步函数，**必须用 useCallback 包裹以保持引用稳定**，
 *   否则每次渲染都会产生新引用，导致 effect 无限触发。
 */
export const useAuthorizedClusters = <T extends FilterFormWithClusters>(
  form: FormInstance<T>,
  setQuery: Dispatch<SetStateAction<T>>,
  fetchFn: () => Promise<string[] | undefined>,
) => {
  const [authorizedClusterIds, setAuthorizedClusterIds] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    let canceled = false;

    fetchFn()
      .then((clusterIds) => {
        if (!canceled) {
          setAuthorizedClusterIds(clusterIds);
        }
      })
      .catch(() => {
        if (!canceled) {
          setAuthorizedClusterIds(undefined);
        }
      });

    return () => {
      canceled = true;
    };
  }, [fetchFn]);

  useEffect(() => {
    if (!authorizedClusterIds) {
      return;
    }

    setQuery((q) => ({
      ...q,
      clusters: (q.clusters ?? []).filter((c) => authorizedClusterIds.includes(c.id)),
    }));

    const currentClusters = form.getFieldValue("clusters") as Cluster[] | undefined;
    form.setFieldValue(
      "clusters",
      (currentClusters ?? []).filter((c) => authorizedClusterIds.includes(c.id)),
    );
  }, [authorizedClusterIds, form, setQuery]);

  return authorizedClusterIds;
};
