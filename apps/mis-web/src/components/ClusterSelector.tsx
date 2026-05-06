import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select } from "antd";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";

interface Props {
  value?: Cluster[];
  onChange?: (clusters: Cluster[]) => void;
  // is using config clusters or not
  // true: use config clusters
  // false or not exist： use current activated clusters from db
  isUsingAllConfigClusters?: boolean;
  authorizedClusterIds?: string[];
}

const p = prefix("component.others.");

export const ClusterSelector: React.FC<Props> = ({
  value,
  onChange,
  isUsingAllConfigClusters,
  authorizedClusterIds,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters, clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const clusters = isUsingAllConfigClusters ? publicConfigClusters : activatedClusters;

  const sortedIds = clusterSortedIdList
    .filter((id) => Object.keys(clusters)?.includes(id))
    .filter((id) => !authorizedClusterIds || authorizedClusterIds.includes(id));

  return (
    <Select
      mode="multiple"
      placeholder={t(p("selectCluster"))}
      value={value?.map((v) => v.id)}
      onChange={(values) => onChange?.(values.map((x) => ({ id: x, name: clusters[x]?.name })))}
      options={sortedIds.map((x) => ({
        value: x,
        label: getI18nConfigCurrentText(clusters[x]?.name, languageId),
      }))}
      style={{ minWidth: "108px" }}
    />
  );
};

interface CommonSingleSelectionProps {
  value?: Cluster;
  label?: string;
  showSearch?: boolean;
}

interface NonClearableSingleSelectionProps extends CommonSingleSelectionProps {
  allowClear?: false;
  onChange?: (cluster: Cluster) => void;
}

interface ClearableSingleSelectionProps extends CommonSingleSelectionProps {
  allowClear: true;
  onChange?: (cluster: Cluster | undefined) => void;
}

export type SingleSelectionProps = NonClearableSingleSelectionProps | ClearableSingleSelectionProps;

export const SingleClusterSelector: React.FC<SingleSelectionProps> = ({
  value,
  onChange,
  label,
  allowClear,
  showSearch,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);
  const sortedIds = clusterSortedIdList.filter((id) => Object.keys(activatedClusters)?.includes(id));

  return (
    <Select
      placeholder={t(p("selectCluster"))}
      value={value?.id}
      onChange={(value) => {
        if (value) {
          const cluster = {
            id: value,
            name: activatedClusters[value].name,
          };
          onChange?.(cluster);
        } else {
          (onChange as ClearableSingleSelectionProps["onChange"])?.(undefined);
        }
      }}
      options={(label ? [{ value: label, label, disabled: true }] : []).concat(
        sortedIds.map((x) => ({
          value: x,
          label: getI18nConfigCurrentText(activatedClusters[x]?.name, languageId),
          disabled: false,
        })),
      )}
      popupMatchSelectWidth={false}
      allowClear={allowClear}
      showSearch={!!showSearch}
      filterOption={(inputValue, option) => {
        const label = option?.label;
        if (typeof label === "string") {
          return label.toLowerCase().includes(inputValue.toLowerCase());
        }
        return false;
      }}
    />
  );
};
