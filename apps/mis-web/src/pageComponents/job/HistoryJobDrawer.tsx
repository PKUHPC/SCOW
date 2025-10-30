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
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { formatTime } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";
import { moneyToString } from "src/utils/money";



interface Props {
  open: boolean;
  item: JobInfo | undefined;
  onClose: () => void;
  showedPrices: ("tenant" | "account")[];
}

const p = prefix("pageComp.job.historyJobDrawer.");
const pCommon = prefix("common.");

export const HistoryJobDrawer: React.FC<Props> = (props) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const drawerItems = [
    [t(pCommon("workName")), "jobName"],
    [t(pCommon("clusterWorkId")), "idJob"],
    [t(pCommon("userId")), "user"],
    [t(pCommon("userName")), "userName"],
    [t(pCommon("account")), "account"],
    [t(pCommon("accountOwnerId")), "accountOwnerId"],
    [t(pCommon("accountOwnerName")), "accountOwnerName"],
    [t(pCommon("clusterName")), "cluster", getClusterName],
    [t(pCommon("partition")), "partition"],
    ["QOS", "qos"],
    [t(p("list")), "nodelist"],
    [t(p("timeSubmit")), "timeSubmit", formatDateTime],
    [t(p("timeStart")), "timeStart", (t) => (t ? formatDateTime(t) : "-")],
    [t(p("timeEnd")), "timeEnd", formatDateTime],
    [t(p("nodesReq")), "nodesReq"],
    [t(p("nodesAlloc")), "nodesAlloc"],
    [t(p("cpusReq")), "cpusReq"],
    [t(p("cpusAlloc")), "cpusAlloc"],
    [t(p("gpus")), "gpu"],
    [t(p("memReq")), "memReq"],
    [t(p("memAlloc")), "memAlloc"],
    [t(p("timeLimit")), "timelimit"],
    [t(p("timeUsed")), "timeUsed", (t) => (t ? formatTime(t * 1000) : t)],
    [t(p("timeWait")), "timeWait", (t) => (t ? formatTime(t * 1000) : t)],
    [t(p("recordTime")), "recordTime", formatDateTime],
    [
      (pr) => pr.showedPrices.length === 1 ? t(p("workFee")) : t(p("tenantFee")), "accountPrice",
      moneyToString, (pr: Props) => pr.showedPrices.includes("account")],
    [
      (pr) => pr.showedPrices.length === 1 ? t(p("workFee")) : t(p("platformFee")), "tenantPrice",
      moneyToString, (pr: Props) => pr.showedPrices.includes("tenant")],
  ] as (
  | [string | ((pr: Props) => string), keyof JobInfo, (v: any) => string, (pr: Props) => boolean]
  )[];


  const { item, onClose, open } = props;

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
            {drawerItems.map((([label, key, format, show]) => (
              (!show || show(props)) ? (
                <Descriptions.Item key={item.idJob} label={typeof label === "string" ? label : label(props)}>
                  {/* 如果是集群项展示，则根据当前语言id获取集群名称 */}
                  {format ?
                    (key === "cluster" ?
                      getClusterName(item[key], languageId, publicConfigClusters) : format(item[key]))
                    : item[key] as string}
                </Descriptions.Item>
              ) : undefined
            ))).filter((x) => x)}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
