import { Typography } from "antd";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ManageJobBillingTable } from "src/pageComponents/job/ManageJobBillingTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";

const p = prefix("pageComp.init.initJobBillingTable.");
const pCommon = prefix("common.");

export const InitJobBillingTable: React.FC = () => {
  const t = useI18nTranslateToString();
  const { clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const currentActivatedClusterIds = Object.keys(activatedClusters);

  const { data, isLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {
      return await api.getBillingItems({
        query: { tenant: undefined, activeOnly: false, currentActivatedClusterIds, clusterSortedIdList },
      });
    }, []),
  });

  return (
    <div>
      <Typography.Paragraph>
        {t(p("set"))}
        <a onClick={reload}>{t(pCommon("fresh"))}</a>
      </Typography.Paragraph>
      {currentActivatedClusterIds.length === 0 && (
        <div style={{ marginBottom: 20 }}>{t("common.noAvailableClusters")}</div>
      )}
      <ManageJobBillingTable data={data} loading={isLoading} tenant={undefined} reload={reload} />
    </div>
  );
};
