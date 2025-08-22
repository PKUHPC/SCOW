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

import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Descriptions, Drawer } from "antd";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { RunningJobInfo } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";

interface Props {
  open: boolean;
  item;
  onClose: () => void;
}

const p = prefix("pageComp.job.runningJobDrawer.");


export const RunningJobDrawer: React.FC<Props> = ({
  item, onClose, open,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const drawerItems = [
    [t(p("cluster")), "cluster", getClusterName],
    [t(p("jobId")), "jobId"],
    [t(p("account")), "account"],
    [t(p("jobName")), "name"],
    [t(p("partition")), "partition"],
    [t(p("qos")), "qos"],
    [t(p("nodes")), "nodes"],
    [t(p("cores")), "cores"],
    [t(p("gpus")), "gpus"],
    [t(p("state")), "state"],
    [t(p("nodesOrReason")), "nodesOrReason"],
    [t(p("runningOrQueueTime")), "runningOrQueueTime"],
    [t(p("submissionTime")), "submissionTime", formatDateTime],
    [t(p("timeLimit")), "timeLimit"],
  ] as ([string, keyof RunningJobInfo] | [string, keyof RunningJobInfo, (v: any, r: RunningJobInfo) => string])[];

  return (
    <Drawer
      width={500}
      placement="right"
      onClose={onClose}
      open={open}
      title={t(p("drawerTitle"))}
    >
      {
        item ? (
          <Descriptions
            column={1}
            bordered
            size="small"
          >
            {drawerItems.map(([label, key, format]) => (
              <Descriptions.Item key={item.jobId} label={label}>
                {/* 如果是集群项展示，则根据当前语言id获取集群名称 */}
                {format ?
                  (key === "cluster" ?
                    getClusterName(item[key]?.id, languageId, publicConfigClusters) : format(item[key], item))
                  : item[key] as string}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
