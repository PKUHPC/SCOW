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
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Descriptions, Drawer } from "antd";
import dayjs from "dayjs";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { formatTime, RunningJobInfo } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";
import { getAiExceptionJobI18nReason } from "src/utils/form";

interface Props {
  open: boolean;
  item: RunningJobInfo | undefined;
  onClose: () => void;
}

const p = prefix("pageComp.job.runningJobDrawer.");
const pCommon = prefix("common.");

export const RunningJobDrawer: React.FC<Props> = ({
  item, onClose, open,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const drawerItems = [
    [t(pCommon("workName")), "name"],
    [t(pCommon("workId")), "jobId"],
    [t(pCommon("status")), "state"],
    [t(pCommon("userId")), "user"],
    [t(pCommon("account")), "account"],
    [t(pCommon("cluster")), "cluster", getClusterName],
    [t(pCommon("partition")), "partition"],
    ["QOS", "qos"],
    [t(pCommon("list")), "nodelist"],
    [t(pCommon("timeSubmit")), "submissionTime", formatDateTime],
    [t(pCommon("startTime")), "startTime", (t) => (t ? formatDateTime(t) : "-")],
    [t(p("nodes")), "nodes"],
    [t(p("nodesAlloc")), "nodesAlloc"],
    [t(p("cores")), "cores"],
    [t(p("cpusAlloc")), "cpusAlloc"],
    [t(p("gpus")), "gpus"],
    [t(p("gpusAlloc")), "gpusAlloc"],
    [t(p("memReq")), "memReq"],
    [t(p("memAlloc")), "memAlloc"],
    [t(pCommon("reason")), "reason", getAiExceptionJobI18nReason],
    [t(p("timeLimit")), "timeLimit"],
    [t(pCommon("timeUsed")), "runningTime"],
    [t(pCommon("timeWait")), "startTime", (t, r) => formatTime(dayjs(t).diff(r.submissionTime))],
  ] as ([string, keyof RunningJobInfo] | [string, keyof JobInfo, (v: any, r: RunningJobInfo) => string])[];

  return (
    <Drawer
      width={500}
      placement="right"
      onClose={onClose}
      open={open}
      title={t(p("detail"))}
    >
      {
        item ? (
          <Descriptions
            column={1}
            bordered
            size="small"
          >
            {drawerItems.map((([label, key, format]) => (
              <Descriptions.Item key={item.jobId} label={label}>
                {format ?
                  // 如果是集群项展示，则根据当前语言id获取集群名称
                  (key === "cluster"
                    ? getClusterName(item[key].id, languageId, publicConfigClusters)
                    // 如果原因展示，则获取可以展示国际化的AI异常状态原因
                    : key === "reason" && item[key] !== undefined
                      ? getAiExceptionJobI18nReason(item[key], t)
                      : format(item[key], item))
                  : item[key]}
              </Descriptions.Item>
            )))}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
