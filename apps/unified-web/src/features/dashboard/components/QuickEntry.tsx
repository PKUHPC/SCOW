import {
  AppstoreOutlined,
  BookOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  LoginOutlined,
  PlusCircleOutlined,
  ProfileOutlined,
  SaveOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { QuickEntry as LibQuickEntry } from "@scow/lib-web/build/components/quickEntry";
import type { Entry } from "@scow/lib-web/build/components/quickEntry";
import { App } from "antd";
import { cloneElement } from "react";
import type { CSSProperties, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useQuickEntriesQuery, useSaveQuickEntriesMutation } from "src/features/dashboard/queries";
import type { DashboardSource } from "src/features/dashboard/types";

const portalEntryItems = {
  defaultEntries: [
    {
      id: "submitJob",
      name: "submitJob",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/submit", icon: "PlusCircleOutlined" } },
    },
    {
      id: "runningJob",
      name: "runningJobs",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/runningJobs", icon: "BookOutlined" } },
    },
    {
      id: "allJobs",
      name: "allJobs",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/allJobs", icon: "AllJobsOutlined" } },
    },
  ],
  staticEntries: [
    {
      id: "loginCluster",
      name: "loginCluster",
      entry: { $case: "pageLink" as const, pageLink: { path: "/loginCluster", icon: "LoginClusterOutlined" } },
    },
    {
      id: "shell",
      name: "shell",
      entry: {
        $case: "shell" as const,
        shell: { clusterId: "", loginNode: "", icon: "MacCommandOutlined" },
      },
    },
    {
      id: "appSessions",
      name: "appSessions",
      entry: { $case: "pageLink" as const, pageLink: { path: "/apps/sessions", icon: "AppSessionsIcon" } },
    },
    {
      id: "fileManage",
      name: "fileManage",
      entry: {
        $case: "clusterPageLink" as const,
        clusterPageLink: { path: "/files/clusterId/~", clusterId: "", icon: "FileManagerIcon" },
      },
    },
  ],
};

const aiEntryItems = {
  defaultEntries: [
    {
      id: "dataset",
      name: "dataset",
      entry: { $case: "pageLink" as const, pageLink: { path: "asset/dataset", icon: "DatasetIcon" } },
    },
    {
      id: "image",
      name: "image",
      entry: { $case: "pageLink" as const, pageLink: { path: "asset/image", icon: "ImageIcon" } },
    },
    {
      id: "algorithm",
      name: "algorithm",
      entry: { $case: "pageLink" as const, pageLink: { path: "asset/algorithm", icon: "AlgorithmIcon" } },
    },
    {
      id: "model",
      name: "model",
      entry: { $case: "pageLink" as const, pageLink: { path: "asset/model", icon: "ModelIcon" } },
    },
  ],
  staticEntries: [
    {
      id: "app",
      name: "app",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/createApp", icon: "CreateAppIcon" } },
    },
    {
      id: "trainJobs",
      name: "trainJobs",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/createTrain", icon: "TrainJobIcon" } },
    },
    {
      id: "inference",
      name: "inference",
      entry: { $case: "pageLink" as const, pageLink: { path: "/jobs/createInfer", icon: "InferIcon" } },
    },
    {
      id: "runningJobs",
      name: "runningJobs",
      entry: { $case: "pageLink" as const, pageLink: { path: "jobs/jobList", icon: "RunningJobsIcon" } },
    },
    {
      id: "historyJobs",
      name: "historyJobs",
      entry: {
        $case: "pageLink" as const,
        pageLink: { path: "jobs/jobList?jobType=historyJobs", icon: "HistoryJobsIcon" },
      },
    },
    {
      id: "file",
      name: "file",
      entry: { $case: "pageLink" as const, pageLink: { path: "files/~", icon: "FileIcon" } },
    },
  ],
};

function LegacySizedIcon({ icon, style }: { icon: ReactElement<{ style?: CSSProperties }>; style?: CSSProperties }) {
  return (
    <span
      style={{
        ...style,
        width: 16,
        height: 16,
        fontSize: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {cloneElement(icon, { style: { color: "inherit", fontSize: 16 } })}
    </span>
  );
}

const fitLegacyIcon = (icon: ReactElement<{ style?: CSSProperties }>) => <LegacySizedIcon icon={icon} />;

const iconMap = {
  PlusCircleOutlined: fitLegacyIcon(<PlusCircleOutlined />),
  BookOutlined: fitLegacyIcon(<BookOutlined />),
  SaveOutlined: fitLegacyIcon(<SaveOutlined />),
  LoginClusterOutlined: fitLegacyIcon(<LoginOutlined />),
  MacCommandOutlined: fitLegacyIcon(<CodeOutlined />),
  AllJobsOutlined: fitLegacyIcon(<UnorderedListOutlined />),
  AppSessionsIcon: fitLegacyIcon(<AppstoreOutlined />),
  FileManagerIcon: fitLegacyIcon(<FolderOpenOutlined />),
  DatasetIcon: fitLegacyIcon(<DatabaseOutlined />),
  ImageIcon: fitLegacyIcon(<ProfileOutlined />),
  AlgorithmIcon: fitLegacyIcon(<CodeOutlined />),
  ModelIcon: fitLegacyIcon(<DatabaseOutlined />),
  CreateAppIcon: fitLegacyIcon(<AppstoreOutlined />),
  TrainJobIcon: fitLegacyIcon(<PlusCircleOutlined />),
  InferIcon: fitLegacyIcon(<ProfileOutlined />),
  RunningJobsIcon: fitLegacyIcon(<BookOutlined />),
  FileIcon: fitLegacyIcon(<FileOutlined />),
  HistoryJobsIcon: fitLegacyIcon(<HistoryOutlined />),
};

interface Props {
  enabledSources: DashboardSource[];
  sourceBasePaths: Partial<Record<DashboardSource, string>>;
}

export function QuickEntry({ enabledSources, sourceBasePaths }: Props) {
  const { message } = App.useApp();
  const { i18n, t } = useTranslation("dashboard");
  const quickEntriesQuery = useQuickEntriesQuery(enabledSources, sourceBasePaths);
  const saveMutation = useSaveQuickEntriesMutation();
  const source = quickEntriesQuery.data?.source ?? (enabledSources.includes("portal") ? "portal" : "ai");
  const entryItems = source === "portal" ? portalEntryItems : aiEntryItems;

  const saveQuickEntries = async (entries: Entry[]) => {
    try {
      await saveMutation.mutateAsync({ source, entries });
      message.success(t("dashboard.quickEntry.saveSuccessfully", "保存成功"));
    } catch {
      message.error(t("dashboard.quickEntry.saveFailed", "保存失败"));
    }
  };

  return (
    <LibQuickEntry
      isLoading={quickEntriesQuery.isLoading}
      quickEntryType={source}
      currentClusters={quickEntriesQuery.data?.currentClusters ?? []}
      publicConfigClusters={quickEntriesQuery.data?.publicConfigClusters ?? []}
      publicPath={quickEntriesQuery.data?.publicPath ?? ""}
      basePath={quickEntriesQuery.data?.basePath ?? ""}
      languageId={i18n.language}
      entryItems={entryItems}
      iconMap={iconMap}
      loginNodes={quickEntriesQuery.data?.loginNodes ?? {}}
      quickEntriesData={
        quickEntriesQuery.data?.entries.length ? quickEntriesQuery.data.entries : entryItems.defaultEntries
      }
      availableApps={quickEntriesQuery.data?.availableApps ?? {}}
      onSaveQuickEntries={(entries) => void saveQuickEntries(entries)}
    />
  );
}
