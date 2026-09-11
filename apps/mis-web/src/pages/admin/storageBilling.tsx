import { Tabs } from "antd";
import { NextPage } from "next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { fetchStorageBillingItems } from "src/utils/storageBilling";
import { requireAuth } from "src/auth/requireAuth";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { StorageBillingTable } from "src/pageComponents/storageBilling/StorageBillingTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { getStorageDisplayName } from "src/utils/storageDisplay";
import { styled } from "styled-components";

const FilterSection = styled(FilterFormContainer)`
  margin: 8px 0 12px;
  padding: 8px 24px 16px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;

  .ant-tabs {
    margin-bottom: 8px;
  }

  .ant-tabs-nav {
    margin-bottom: 8px;
  }
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const FilterLabel = styled.span`
  white-space: nowrap;
  margin-right: 16px;
  color: #434343;
`;

const FilterBtnGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FilterBtn = styled.button<{ $active: boolean }>`
  height: 32px;
  padding: 0 16px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.token.colorPrimary : "#d9d9d9")};
  border-radius: 4px;
  background: #fff;
  color: ${({ $active, theme }) => ($active ? theme.token.colorPrimary : "#434343")};
  cursor: pointer;
  font-size: 14px;
  line-height: 30px;
  transition: all 0.2s;

  &:hover {
    color: ${({ theme }) => theme.token.colorPrimary};
    border-color: ${({ theme }) => theme.token.colorPrimary};
  }
`;

const p = prefix("page.storageBilling.");

const AdminStorageBillingPage: NextPage =
  requireAuth(
    (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
    () => publicConfig.STORAGE_BILLING_ENABLED ? undefined : <NotFoundPage />,
  )(
    () => {

      const [activeKey, setActiveKey] = useState<"platform" | "tenant">("platform");
      const [selectedStorageId, setSelectedStorageId] = useState<string | undefined>(undefined);
      const [selectedTenant, setSelectedTenant] = useState<string | undefined>(undefined);

      const t = useI18nTranslateToString();
      const languageId = useI18n().currentLanguage.id;
      const { publicStorageConfigs } = useStore(ClusterInfoStore);

      const storageIds = useMemo(
        () => Object.keys(publicStorageConfigs),
        [publicStorageConfigs],
      );

      const fetchTenants = useCallback(async () => {
        return api.getTenants({ query: {} });
      }, []);
      const { data: tenantsData } = useAsync({ promiseFn: fetchTenants });
      const tenantNames = useMemo(() => tenantsData?.names ?? [], [tenantsData?.names]);
      const effectiveTenant = activeKey === "tenant" ? (selectedTenant ?? tenantNames[0]) : undefined;

      useEffect(() => {
        if (activeKey === "tenant" && !selectedTenant && tenantNames[0]) {
          setSelectedTenant(tenantNames[0]);
        }
      }, [activeKey, selectedTenant, tenantNames]);

      const fetchBillingData = useCallback(async () => {
        if (activeKey === "tenant" && !effectiveTenant) return [];
        return fetchStorageBillingItems(storageIds, effectiveTenant);
      }, [storageIds, activeKey, effectiveTenant]);

      const { data: billingData, isLoading, reload } = useAsync({
        promiseFn: fetchBillingData,
        watch: `${activeKey}:${effectiveTenant ?? ""}:${storageIds.join(",")}`,
      });

      const allData = billingData ?? [];
      const tableData = selectedStorageId
        ? allData.filter((d) => d.storageId === selectedStorageId)
        : allData;

      return (
        <div>
          <Head title={t(p("storageResource"))} />
          <PageTitle titleText={t(p("storageResource"))} />

          <FilterSection>
            <Tabs
              activeKey={activeKey}
              onChange={(key) => {
                setActiveKey(key as "platform" | "tenant");
                setSelectedTenant(undefined);
                setSelectedStorageId(undefined);
              }}
              items={[
                { key: "platform", label: t("common.platform") },
                { key: "tenant", label: t("common.tenant") },
              ]}
            />

            <FilterRow>
              <FilterLabel>{t(p("fileSystemTitle"))}</FilterLabel>
              <FilterBtnGroup>
                <FilterBtn
                  $active={selectedStorageId === undefined}
                  onClick={() => setSelectedStorageId(undefined)}
                >
                  {t(p("all"))}
                </FilterBtn>
                {storageIds.map((id) => (
                  <FilterBtn
                    key={id}
                    $active={selectedStorageId === id}
                    onClick={() => setSelectedStorageId(id)}
                  >
                    {getStorageDisplayName(id, languageId, publicStorageConfigs)}
                  </FilterBtn>
                ))}
              </FilterBtnGroup>
            </FilterRow>

            {activeKey === "tenant" && tenantNames.length > 0 && (
              <FilterRow>
                <FilterLabel>{t("common.tenant")}</FilterLabel>
                <FilterBtnGroup>
                  {tenantNames.map((name) => (
                    <FilterBtn
                      key={name}
                      $active={effectiveTenant === name}
                      onClick={() => setSelectedTenant(name)}
                    >
                      {name}
                    </FilterBtn>
                  ))}
                </FilterBtnGroup>
              </FilterRow>
            )}
          </FilterSection>

          {(activeKey === "platform" || effectiveTenant) && (
            <StorageBillingTable
              data={tableData}
              loading={isLoading}
              reload={reload}
              tenantName={effectiveTenant}
              canEdit={true}
            />
          )}
        </div>
      );
    },
  );

export default AdminStorageBillingPage;
