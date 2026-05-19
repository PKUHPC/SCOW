import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Descriptions, Drawer } from "antd";
import dayjs from "dayjs";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { formatTime, RunningJobInfo } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { getClusterName } from "src/utils/cluster";

interface Props {
  open: boolean;
  item;
  onClose: () => void;
}

const p = prefix("pageComp.job.jobDrawer.");
const pCommon = prefix("common.");

export const JobDrawer: React.FC<Props> = ({ item, onClose, open }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);
  const { user } = useStore(UserStore);

  const drawerItems = [
    [t(p("jobName")), "name"],
    [t(p("jobId")), "jobId"],
    [t(p("state")), "state"],
    [t(p("userName")), "userName", () => user?.name ?? "-"],
    [t(p("userId")), "userId", () => user?.identityId ?? "-"],
    [t(p("account")), "account"],
    [t(p("cluster")), "cluster", getClusterName],
    [t(p("partition")), "partition"],
    [t(p("qos")), "qos"],
    [t(pCommon("list")), "nodelist"],
    [t(pCommon("timeSubmit")), "submitTime", formatDateTime],
    [t(pCommon("startTime")), "startTime", (t) => (t ? formatDateTime(t) : "-")],
    [t(pCommon("endTime")), "endTime", (t) => (t ? formatDateTime(t) : "-")],
    [t(p("nodes")), "nodes"],
    [t(p("nodesAlloc")), "nodesAlloc"],
    [t(p("cores")), "cores"],
    [t(p("cpusAlloc")), "cpusAlloc"],
    [t(p("gpus")), "gpus"],
    [t(p("gpusAlloc")), "gpusAlloc"],
    [t(p("memReq")), "memReq"],
    [t(p("memAlloc")), "memAlloc"],
    [t(pCommon("reason")), "reason"],
    [t(p("timeLimit")), "timeLimit"],
    [t(pCommon("timeUsed")), "runningTime", (t, r) => t ?? r.elapsed],
    [t(pCommon("timeWait")), "startTime", (t, r) => formatTime(dayjs(t).diff(r.submitTime))],
  ] as ([string, keyof RunningJobInfo] | [string, keyof RunningJobInfo, (v: any, r: RunningJobInfo) => string])[];
  return (
    <Drawer width={500} placement="right" onClose={onClose} open={open} title={t(p("drawerTitle"))}>
      {item ? (
        <Descriptions column={1} bordered size="small">
          {drawerItems.map(([label, key, format], index) => (
            <Descriptions.Item key={`${item.jobId}-${key}-${index}`} label={label}>
              {/* 如果是集群项展示，则根据当前语言id获取集群名称 */}
              {format
                ? key === "cluster"
                  ? getClusterName(item[key]?.id, languageId, publicConfigClusters)
                  : format(item[key], item)
                : (item[key] as string)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : undefined}
    </Drawer>
  );
};
