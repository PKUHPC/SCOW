import Icon from "@ant-design/icons";
import { I18nStringType } from "@scow/config/build/i18n";
import { Button, Spin } from "antd";
import { useState } from "react";
import { Cluster } from "src/utils/cluster";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { styled } from "styled-components";

import { DashboardSection } from "./DashboardSection";
import { Sortable } from "./Sortable";

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const EditButton = styled(Button)`
`;

interface PageLinkEntry {
  path: string;
  /** antd的图标ID */
  icon: string;
}

interface ShellEntry {
  clusterId: string;
  loginNode: string;
  /** antd的图标ID */
  icon: string;
}

interface AppEntry {
  appId: string;
  clusterId: string;
  /**
   * 应用图标的路径
   * 只在getQuickEntriesResponse中使用，获取查询时config下配置的应用图标路径
   * 前端会根据这个路径加载应用图标
   */
  appLogoPath?: string | undefined;
}

interface ClusterPageLinkEntry {
  clusterId: string;
  path: string;
  /** antd的图标ID */
  icon: string;
}

export interface Entry {
  id: string;
  name: string;
  entry?:
    | { $case: "pageLink"; pageLink: PageLinkEntry }
    | { $case: "shell"; shell: ShellEntry }
    | { $case: "app"; app: AppEntry }
    | { $case: "clusterPageLink"; clusterPageLink: ClusterPageLinkEntry }
    | undefined;
}

export interface App { id: string; name: string; logoPath?: string; };

export type AppWithCluster = Record<string, {
  app: App;
  clusters: Cluster[];
}>;

interface Props {
  currentClusters: Cluster[];
  publicConfigClusters: Cluster[];
  languageId: string;
  iconMap: Record<string, React.ReactElement>;
  entryItems: {
    defaultEntries: Entry[];
    staticEntries: Entry[];
  }
  availableApps: AppWithCluster;
  isLoading: boolean;
  quickEntriesData: Entry[];
  publicPath: string;
  basePath: string;
  quickEntryType?: "ai" | "portal";
  loginNodes?: Record<string, { name: I18nStringType; address: string }[]>;
  onSaveQuickEntries: (newItems: Entry[]) => void
}

const entryEditSVG = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.33337 2.66667H2.66671C2.31309 2.66667 1.97395 2.80715 1.7239 3.05719C1.47385 3.30724 1.33337
      3.64638 1.33337 4V13.3333C1.33337 13.687 1.47385 14.0261 1.7239 14.2761C1.97395 14.5262 2.31309 14.6667
      2.66671 14.6667H12C12.3537 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3334 13.687 13.3334
      13.3333V8.66667M12.3334 1.66667C12.5986 1.40145 12.9583 1.25246 13.3334 1.25246C13.7084 1.25246 14.0682
      1.40145 14.3334 1.66667C14.5986 1.93189 14.7476 2.2916 14.7476 2.66667C14.7476 3.04174 14.5986 3.40145 14.3334
      3.66667L8.00004 10L5.33337 10.6667L6.00004 8L12.3334 1.66667Z"
      stroke="#434343"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const QuickEntry: React.FC<Props> = ({
  currentClusters, publicConfigClusters, iconMap, languageId, quickEntryType,
  publicPath, basePath, loginNodes, entryItems, availableApps, isLoading, quickEntriesData, onSaveQuickEntries }) => {

  const [isEditable, setIsEditable] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  return (
    <DashboardSection
      style={{ marginBottom: "16px", minHeight: "320px", boxShadow: "#0000000D 0px 4px 4px 0px" }}
      title={ (
        <span>{getCurrentLangLibWebText(languageId, "quickEntry")}</span>
      )}
      extra={
        isEditable ? (
          <div>
            <EditButton
              style={{ marginRight:"20px" }}
              onClick={() => { setIsEditable(false); setIsFinished(true); }}
            >
              <span>{getCurrentLangLibWebText(languageId, "finish")}</span>
            </EditButton>
            <EditButton
              onClick={() => { setIsEditable(false); }}
            >
              <span>{getCurrentLangLibWebText(languageId, "cancel")}</span>
            </EditButton>
          </div>
        ) : (
          <Icon component={entryEditSVG} onClick={() => { setIsEditable(true); setIsFinished(false); }} />
        )}
    >
      <CardsContainer>
        {isLoading ?
          <Spin /> : (
            <Sortable
              isEditable={isEditable}
              isFinished={isFinished}
              quickEntryArray={quickEntriesData}
              entryItems={entryItems}
              apps={availableApps}
              currentClusters={currentClusters}
              publicConfigClusters={publicConfigClusters}
              iconMap={iconMap}
              publicPath={publicPath}
              basePath={basePath}
              languageId={languageId}
              loginNodes={loginNodes}
              quickEntryType={quickEntryType}
              onSaveQuickEntries={onSaveQuickEntries}
            ></Sortable>
          )}
      </CardsContainer>
    </DashboardSection>
  );
};
