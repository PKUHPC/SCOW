import type { ReactNode } from "react";

import { QuestionCircleOutlined } from "@ant-design/icons";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Descriptions, Drawer, Space, Tooltip } from "antd";
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

const labelWithTooltip = (label: string, tooltip: string): ReactNode => (
  <Space size={4}>
    {label}
    <Tooltip title={tooltip}>
      <QuestionCircleOutlined />
    </Tooltip>
  </Space>
);

export const HistoryJobDrawer: React.FC<Props> = (props) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const { item, onClose, open } = props;

  const nonPlatformUser = t(pCommon("nonPlatformUser"));
  const isExternal = !item?.userName;

  const drawerItems = [
    [t(pCommon("workName")), "jobName"],
    [t(pCommon("clusterWorkId")), "idJob"],
    [t(pCommon("userName")), "userName", (v) => (isExternal ? nonPlatformUser : (v ?? "-"))],
    [t(pCommon("userId")), "user", (v) => (isExternal ? nonPlatformUser : (v ?? "-"))],
    [t(pCommon("account")), "account"],
    [t(pCommon("accountOwnerName")), "accountOwnerName"],
    [t(pCommon("accountOwnerId")), "accountOwnerId"],
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
    [labelWithTooltip(t(p("timeWait")), t(p("timeWaitTip"))), "timeWait", (t) => (t ? formatTime(t * 1000) : t)],
    [t(p("recordTime")), "recordTime", formatDateTime],
    [
      (pr) => labelWithTooltip(pr.showedPrices.length === 1 ? t(p("workFee")) : t(p("tenantFee")), t(p("jobFeeTip"))),
      "accountPrice",
      moneyToString,
      (pr: Props) => pr.showedPrices.includes("account"),
    ],
    [
      (pr) => labelWithTooltip(pr.showedPrices.length === 1 ? t(p("workFee")) : t(p("platformFee")), t(p("jobFeeTip"))),
      "tenantPrice",
      moneyToString,
      (pr: Props) => pr.showedPrices.includes("tenant"),
    ],
  ] as [ReactNode | ((pr: Props) => ReactNode), keyof JobInfo, (v: any) => string, (pr: Props) => boolean][];

  return (
    <Drawer width={500} placement="right" onClose={onClose} open={open} title={t(p("detail"))}>
      {item ? (
        <Descriptions column={1} bordered size="small">
          {drawerItems
            .map(([label, key, format, show]) =>
              !show || show(props) ? (
                <Descriptions.Item key={item.idJob} label={typeof label === "function" ? label(props) : label}>
                  {/* 如果是集群项展示，则根据当前语言id获取集群名称 */}
                  {format
                    ? key === "cluster"
                      ? getClusterName(item[key], languageId, publicConfigClusters)
                      : format(item[key])
                    : (item[key] as string)}
                </Descriptions.Item>
              ) : undefined,
            )
            .filter((x) => x)}
        </Descriptions>
      ) : undefined}
    </Drawer>
  );
};
