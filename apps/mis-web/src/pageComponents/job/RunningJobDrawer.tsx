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
import { nullableMoneyToString } from "src/utils/money";

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
    [t(pCommon("userName")), "userName", (v) => v ?? "-"],
    [t(pCommon("userId")), "user"],
    [t(pCommon("account")), "account"],
    [t(pCommon("accountOwnerName")), "accountOwnerName", (v) => v ?? "-"],
    [t(pCommon("accountOwnerId")), "accountOwnerId", (v) => v ?? "-"],
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
    [t(p("accountPrice")), "accountPrice", (v) => nullableMoneyToString(v)],
    [t(p("tenantPrice")), "tenantPrice", (v) => nullableMoneyToString(v)],
    [t(p("chargingPeriod")), "chargingPeriod"],
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
            labelStyle={{ whiteSpace: "nowrap" }}
          >
            {drawerItems.map((([label, key, format]) => (
              <Descriptions.Item key={item.jobId} label={label}>
                {(() => {
                  const value = format
                    ? (key === "cluster"
                      ? getClusterName(item[key].id, languageId, publicConfigClusters)
                      : key === "reason" && item[key] !== undefined
                        ? getAiExceptionJobI18nReason(item[key], t)
                        : format(item[key], item))
                    : item[key];

                  if (key === "chargingPeriod") {
                    const period = item.chargingPeriod;
                    const text = period?.startTime && period?.endTime ?
                      `${new Date(period.startTime).toLocaleString()} ~
                    ${new Date(period.endTime).toLocaleString()}` : "-";
                    return <span style={{ whiteSpace: "pre-line" }}>{text}</span>;
                  }

                  return value;
                })()}
              </Descriptions.Item>
            )))}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
