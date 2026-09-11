import { NextPage } from "next";
import React, { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { fetchStorageBillingItems } from "src/utils/storageBilling";
import { requireAuth } from "src/auth/requireAuth";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { StorageBillingTable } from "src/pageComponents/storageBilling/StorageBillingTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { getStorageDisplayName } from "src/utils/storageDisplay";
import { styled } from "styled-components";

const FilterSection = styled(FilterFormContainer)`
  margin: 8px 0 12px;
  padding: 16px 24px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
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

const TenantStorageBillingPage: NextPage =
  requireAuth(
    (u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    () => publicConfig.STORAGE_BILLING_ENABLED ? undefined : <NotFoundPage />,
  )(
    () => {

      const userStore = useStore(UserStore);
      const tenantName = userStore.user?.tenant;

      const t = useI18nTranslateToString();
      const languageId = useI18n().currentLanguage.id;
      const { publicStorageConfigs } = useStore(ClusterInfoStore);

      const storageIds = useMemo(
        () => Object.keys(publicStorageConfigs),
        [publicStorageConfigs],
      );

      const [selectedStorageId, setSelectedStorageId] = useState<string | undefined>(undefined);

      const fetchBillingData = useCallback(
        () => fetchStorageBillingItems(storageIds, tenantName),
        [storageIds, tenantName],
      );

      const { data: billingData, isLoading, reload } = useAsync({
        promiseFn: fetchBillingData,
        watch: `${tenantName ?? ""}:${storageIds.join(",")}`,
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
          </FilterSection>

          <StorageBillingTable
            data={tableData}
            loading={isLoading}
            reload={reload}
            tenantName={tenantName}
            canEdit={true}
          />
        </div>
      );
    },
  );

export default TenantStorageBillingPage;
