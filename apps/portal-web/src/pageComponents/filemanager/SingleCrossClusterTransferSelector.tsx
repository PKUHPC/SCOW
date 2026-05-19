import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select } from "antd";
import React, { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/utils/cluster";

interface SingleSelectionProps {
  value?: Cluster;
  onChange?: (cluster: Cluster) => void;
  label?: string;
  exclude?: Cluster;
}

const p = prefix("pageComp.fileManagerComp.singleCrossClusterTransferSelector.");

export const SingleCrossClusterTransferSelector: React.FC<SingleSelectionProps> = ({
  value,
  onChange,
  label,
  exclude,
}) => {
  const languageId = useI18n().currentLanguage.id;

  const t = useI18nTranslateToString();

  const {
    data: availableClusters = [],
    isLoading,
    reload,
  } = useAsync({
    promiseFn: useCallback(async () => {
      const listClustersResponse = await api.listAvailableTransferClusters({ query: {} });
      const clusterList: Cluster[] = listClustersResponse.clusterList;
      return clusterList;
    }, []),
  });

  return (
    <Select
      labelInValue
      placeholder={t(p("placeholder"))}
      value={value ? { value: value.id, label: value.name } : undefined}
      onChange={({ value, label }) => {
        onChange?.({ id: value, name: label });
        reload();
      }}
      options={(label ? [{ value: label, label, disabled: true }] : []).concat(
        availableClusters
          .filter((x) => !exclude || x.id !== exclude.id)
          .map((x) => ({ value: x.id, label: getI18nConfigCurrentText(x.name, languageId), disabled: false })),
      )}
      dropdownMatchSelectWidth={false}
      loading={isLoading}
    />
  );
};
