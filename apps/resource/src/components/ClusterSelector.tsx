"use client";
import { Cluster } from "@scow/config/build/type";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select } from "antd";
import { getLanguage } from "src/utils/i18n";

interface SingleSelectionProps {
  value?: Cluster;
  onChange?: (cluster: Cluster | undefined) => void;
  label?: string;
  clusterIds?: string[];
  currentClusters: Cluster[];
  languageId?: string,
  allowClear?: boolean;
}

export const SingleClusterSelector: React.FC<SingleSelectionProps> = ({
  value,
  onChange,
  label,
  clusterIds,
  currentClusters,
  languageId,
  allowClear,
}) => {

  const language = getLanguage(languageId);

  return (
    <Select
      placeholder={language.common.clusterSelectorPlaceholder}
      value={value?.id}
      onChange={(value) => {
        onChange?.(value ? {
          id: value,
          name: currentClusters.find((cluster) => cluster.id === value)?.name ?? value,
        }
          : undefined);
      }
      }
      options={
        (label ? [{ value: label, label, disabled: true }] : [])
          .concat((
            currentClusters && currentClusters.length > 0 ?
              currentClusters.filter((x) => clusterIds?.includes(x.id) ?? true)
              : []
          )
            .map((x) => ({
              value: x.id,
              label:  getI18nConfigCurrentText(x.name, languageId),
              disabled: false,
            })))
      }
      popupMatchSelectWidth={false}
      allowClear={allowClear}
    />
  );
};
