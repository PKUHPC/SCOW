import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Space, Tabs } from "antd";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo } from "react";
import { useStore } from "simstate";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { AppScope } from "src/models/app";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

const Toolbar = styled(FilterFormContainer)`
  padding: 12px;
  margin: 8px 0 12px;
  font-size: 14px;
  color: ${({ theme }) => theme.palette.gray[8]};

  .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn,
  .ant-input,
  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    font-size: 14px;
    color: ${({ theme }) => theme.palette.gray[8]};
  }
`;

export const AuthorizationContent = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.palette.gray[8]};

  .ant-table,
  .ant-table-cell,
  .ant-pagination,
  .ant-tag,
  .ant-btn {
    font-size: 14px;
  }

  .ant-table,
  .ant-table-cell,
  .ant-pagination-item:not(.ant-pagination-item-active) a {
    color: ${({ theme }) => theme.palette.gray[8]};
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const SearchContainer = styled.div<{ $width: number }>`
  display: flex;
  flex: 0 1 ${({ $width }) => $width}px;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;

  > * {
    max-width: 100%;
  }

  form {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    min-width: 0;
  }
`;

export const getScopeClusters = (
  clusters: Record<string, Cluster>,
  fullClusterConfigs: ReturnType<typeof ClusterInfoStore>["fullClusterConfigs"],
  scope: AppScope,
) =>
  Object.fromEntries(
    Object.entries(clusters).filter(([clusterId]) =>
      scope === AppScope.HPC ? fullClusterConfigs[clusterId]?.hpc.enabled : fullClusterConfigs[clusterId]?.ai.enabled,
    ),
  );

const getConfiguredAppScopes = (): AppScope[] =>
  // 按照当前右上角跳转链接顺序，HPC在前，AI在后
  [AppScope.HPC, AppScope.AI].filter((scope) =>
    scope === AppScope.HPC ? Boolean(publicConfig.PORTAL_URL) : Boolean(publicConfig.AI_URL),
  );

interface AppScopeClusterSelectionOptions {
  availableClusters: Record<string, Cluster>;
  appScope: AppScope;
  setAppScope: Dispatch<SetStateAction<AppScope>>;
  selectedClusterId: string;
  setSelectedClusterId: Dispatch<SetStateAction<string>>;
}

/** 保证当前平台已部署，并让集群指向该平台下的首个可用项。 */
export const useAppScopeClusterSelection = ({
  availableClusters,
  appScope,
  setAppScope,
  selectedClusterId,
  setSelectedClusterId,
}: AppScopeClusterSelectionOptions) => {
  const { fullClusterConfigs, clusterSortedIdList } = useStore(ClusterInfoStore);
  const scopeClusters = useMemo(
    () => getScopeClusters(availableClusters, fullClusterConfigs, appScope),
    [availableClusters, fullClusterConfigs, appScope],
  );

  useEffect(() => {
    const configuredScopes = getConfiguredAppScopes();
    if (!configuredScopes.includes(appScope) && configuredScopes[0]) {
      setAppScope(configuredScopes[0]);
      return;
    }
    if (!selectedClusterId || !scopeClusters[selectedClusterId]) {
      setSelectedClusterId(clusterSortedIdList.find((clusterId) => scopeClusters[clusterId]) ?? "");
    }
  }, [
    availableClusters,
    fullClusterConfigs,
    scopeClusters,
    clusterSortedIdList,
    appScope,
    selectedClusterId,
    setAppScope,
    setSelectedClusterId,
  ]);
};

interface Props {
  availableClusters: Record<string, Cluster>;
  appScope: AppScope;
  selectedClusterId: string;
  onScopeChange: (scope: AppScope) => void;
  onClusterChange: (clusterId: string) => void;
  search: ReactNode;
  searchWidth?: number;
}

export const AppScopeClusterToolbar: React.FC<Props> = ({
  availableClusters,
  appScope,
  selectedClusterId,
  onScopeChange,
  onClusterChange,
  search,
  searchWidth = 360,
}) => {
  const { fullClusterConfigs, clusterSortedIdList } = useStore(ClusterInfoStore);
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const scopes = getConfiguredAppScopes();
  const scopeClusters = getScopeClusters(availableClusters, fullClusterConfigs, appScope);

  return (
    <Toolbar>
      <Tabs
        activeKey={appScope}
        onChange={(value) => onScopeChange(value as AppScope)}
        items={scopes.map((scope) => ({
          key: scope,
          label: scope === AppScope.HPC ? t("layouts.route.navLinkTextPortal") : t("layouts.route.navLinkTextAI"),
        }))}
      />
      <Controls>
        <Space wrap>
          <span>{t("common.cluster")}:</span>
          {clusterSortedIdList
            .filter((clusterId) => scopeClusters[clusterId])
            .map((clusterId) => (
              <RoundedButton
                key={clusterId}
                type={selectedClusterId === clusterId ? "primary" : "default"}
                $selected={selectedClusterId === clusterId}
                $height="32px"
                onClick={() => onClusterChange(clusterId)}
              >
                {getI18nConfigCurrentText(scopeClusters[clusterId].name, languageId) || clusterId}
              </RoundedButton>
            ))}
        </Space>
        <SearchContainer $width={searchWidth}>{search}</SearchContainer>
      </Controls>
    </Toolbar>
  );
};
