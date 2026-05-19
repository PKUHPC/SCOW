"use client";

import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select, type SelectProps } from "antd";
import { usePublicConfig } from "src/app/(auth)/context";
import { defaultClusterContext } from "src/app/(auth)/defaultClusterContext";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";

interface Props {
  value?: Cluster[];
  onChange?: (clusters: Cluster[]) => void;
}

export const ClusterSelector: React.FC<Props> = ({ value, onChange }) => {
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();
  const currentClusters = publicConfig.CLUSTERS.filter((cluster) => currentAvailableClusterIds.includes(cluster.id));

  return (
    <Select
      mode="multiple"
      placeholder={t("component.clusterSelector.select")}
      value={value?.map((v) => v.id)}
      onChange={(values) =>
        onChange?.(
          values.map((x) => ({
            id: x,
            name: currentClusters.find((cluster) => cluster.id === x)?.name ?? x,
          })),
        )
      }
      options={currentClusters.map((x) => ({ value: x.id, label: getI18nConfigCurrentText(x.name, languageId) }))}
      key={languageId}
    />
  );
};

interface SingleSelectionProps {
  value?: Cluster;
  defaultValue?: Cluster;
  onChange?: (cluster: Cluster) => void;
  label?: string;
  clusterIds?: string[];
  allowClear?: boolean;
}

const SingleClusterSelectorBase: React.FC<
  SingleSelectionProps & { SelectComponent: React.ComponentType<SelectProps> }
> = ({ value, SelectComponent, defaultValue, onChange, label, clusterIds, allowClear }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();
  const { setDefaultCluster, currentClusters } = defaultClusterContext(
    publicConfig.CLUSTERS,
    currentAvailableClusterIds,
  );

  return (
    <SelectComponent
      placeholder={t("component.clusterSelector.select")}
      value={value?.id}
      defaultValue={defaultValue?.id}
      onChange={(value: unknown) => {
        const clusterId = value as string;
        onChange?.({
          id: clusterId,
          name: currentClusters.find((cluster) => cluster.id === clusterId)?.name ?? clusterId,
        });
        setDefaultCluster({
          id: clusterId,
          name: currentClusters.find((cluster) => cluster.id === clusterId)?.name ?? clusterId,
        });
      }}
      options={(label ? [{ value: label, label, disabled: true }] : []).concat(
        (currentClusters.filter((x) => clusterIds?.includes(x.id) ?? true) || []).map((x) => ({
          value: x.id,
          label: getI18nConfigCurrentText(x.name, languageId),
          disabled: false,
        })),
      )}
      popupMatchSelectWidth={false}
      allowClear={allowClear}
    />
  );
};

export const SingleClusterSelector: React.FC<SingleSelectionProps> = (props) => (
  <SingleClusterSelectorBase {...props} SelectComponent={Select} />
);

export const RoundedSingleClusterSelector: React.FC<SingleSelectionProps> = (props) => (
  <SingleClusterSelectorBase {...props} SelectComponent={RoundedSelect} />
);
