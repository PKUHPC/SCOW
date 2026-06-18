"use client";

import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select, type SelectProps } from "antd";
import type { CSSProperties } from "react";
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

interface SingleSelectionBaseProps {
  label?: string;
  clusterIds?: string[];
  allowClear?: boolean;
  style?: CSSProperties;
}

type SingleSelectionProps =
  | (SingleSelectionBaseProps & {
      includeAllOption?: false;
      value?: Cluster;
      defaultValue?: Cluster;
      onChange?: (cluster: Cluster) => void;
    })
  | (SingleSelectionBaseProps & {
      includeAllOption: true;
      value?: string;
      defaultValue?: string;
      onChange?: (clusterId: string | undefined) => void;
    });

const SingleClusterSelectorBase: React.FC<
  SingleSelectionProps & { SelectComponent: React.ComponentType<SelectProps> }
> = (props) => {
  const { value, SelectComponent, defaultValue, onChange, label, clusterIds, allowClear, style } = props;
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();
  const { setDefaultCluster, currentClusters } = defaultClusterContext(
    publicConfig.CLUSTERS,
    currentAvailableClusterIds,
  );
  const includeAllOption = props.includeAllOption;
  const selectedValue = typeof value === "string" ? value : value?.id;
  const selectedDefaultValue = typeof defaultValue === "string" ? defaultValue : defaultValue?.id;
  const options: SelectProps["options"] = (label ? [{ value: label, label, disabled: true }] : [])
    .concat(includeAllOption ? [{ value: "ALL", label: t("app.dataset.model.all"), disabled: false }] : [])
    .concat((currentClusters.filter((x) => clusterIds?.includes(x.id) ?? true) || []).map((x) => ({
      value: x.id,
      label: getI18nConfigCurrentText(x.name, languageId),
      disabled: false,
    })));

  return (
    <SelectComponent
      placeholder={t("component.clusterSelector.select")}
      value={selectedValue}
      defaultValue={selectedDefaultValue}
      onChange={(value: unknown) => {
        const clusterId = value as string | undefined;

        if (includeAllOption && clusterId === "ALL") {
          onChange?.(clusterId as never);
          return;
        }

        if (!clusterId) {
          onChange?.(undefined as never);
          return;
        }

        const cluster = {
          id: clusterId,
          name: currentClusters.find((cluster) => cluster.id === clusterId)?.name ?? clusterId,
        };

        onChange?.((includeAllOption ? clusterId : cluster) as never);
        setDefaultCluster(cluster);
      }}
      options={options}
      popupMatchSelectWidth={false}
      allowClear={allowClear}
      style={style}
    />
  );
};

export const SingleClusterSelector: React.FC<SingleSelectionProps> = (props) => (
  <SingleClusterSelectorBase {...props} SelectComponent={Select} />
);

export const RoundedSingleClusterSelector: React.FC<SingleSelectionProps> = (props) => (
  <SingleClusterSelectorBase {...props} SelectComponent={RoundedSelect} />
);
