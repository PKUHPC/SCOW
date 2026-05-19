import { Select } from "antd";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
export interface Cluster {
  id: string;
  name: string;
}

interface Props {
  clusters: Cluster[];
  value?: Cluster[];
  onChange?: (clusters: Cluster[]) => void;
  languageId: string;
}

export const ClusterSelector: React.FC<Props> = ({ clusters, value, onChange, languageId }) => {
  return (
    <Select
      mode="multiple"
      labelInValue
      placeholder={getCurrentLangLibWebText(languageId, "clusterSelectorPlaceholder")}
      value={value ? value.map((v) => ({ value: v.id, label: v.name })) : undefined}
      onChange={(values) => onChange?.(values.map((x) => ({ id: x.value, name: x.label })))}
      options={clusters.map((x) => ({ value: x.id, label: x.name }))}
      style={{ minWidth: "96px" }}
    />
  );
};

interface SingleSelectionProps {
  clusters: Cluster[];
  value?: Cluster;
  onChange?: (cluster: Cluster) => void;
  label?: string;
  languageId: string;
}

export const SingleClusterSelector: React.FC<SingleSelectionProps> = ({
  clusters,
  value,
  onChange,
  label,
  languageId,
}) => {
  return (
    <Select
      labelInValue
      placeholder={getCurrentLangLibWebText(languageId, "clusterSelectorPlaceholder")}
      value={value ? { value: value.id, label: value.name } : undefined}
      onChange={({ value, label }) => onChange?.({ id: value, name: label })}
      options={(label ? [{ value: label, label, disabled: true }] : []).concat(
        clusters.map((x) => ({ value: x.id, label: x.name, disabled: false })),
      )}
      dropdownMatchSelectWidth={false}
    />
  );
};
