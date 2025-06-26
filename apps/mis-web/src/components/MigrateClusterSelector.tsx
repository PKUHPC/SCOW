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

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select } from "antd";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

const p = prefix("component.others.");

interface MigrateSingleSelectionProps {
  value?: Cluster;
  onChange?: (cluster: Cluster) => void;
  label?: string;
}

export const MigrateSingleClusterSelector: React.FC<MigrateSingleSelectionProps> = ({ value, onChange, label }) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);

  const sortedIds =
    clusterSortedIdList.filter((id) => Object.keys(activatedClusters)?.includes(id));

  const NODE_MIGRATION = publicConfig.NODE_MIGRATION;

  if (!NODE_MIGRATION) {
    throw new Error("Node migration configuration is not properly configured.");
  }

  const migratableClusterGroups = NODE_MIGRATION.migratableClusterGroups;

  const isValidConfig = migratableClusterGroups &&
  migratableClusterGroups.length > 0 &&
  migratableClusterGroups.every((c) => c.group?.length > 1);

  if (!isValidConfig) {
    throw new Error("Node migration configuration is not properly configured for the group.");
  }

  const clusterGroups = migratableClusterGroups.reduce((acc, curr) => {
    curr.group.forEach((g) => acc.add(g)); // 直接操作Set去重
    return acc;
  }, new Set<string>());

  const configuredArr = Array.from(clusterGroups);

  const filteredIds =
  sortedIds.filter((id) => configuredArr.includes(id));

  return (
    <Select
      placeholder={t(p("selectCluster"))}
      value={value?.id}
      onChange={(value) => onChange?.({ id: value, name: activatedClusters[value].name })}
      options={
        (label ? [{ value: label, label, disabled: true }] : [])
          .concat(filteredIds.map((x) => ({
            value: x,
            label:  getI18nConfigCurrentText(activatedClusters[x]?.name, languageId),
            disabled: false,
          })))
      }
      popupMatchSelectWidth={false}
    />
  );
};

