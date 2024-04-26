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

import { queryToString, useQuerystring } from "@scow/lib-web/build/utils/querystring";
import { Button, Form, Space } from "antd";
import { NextPage } from "next";
import Router from "next/router";
import React, { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { ManageJobBillingTable } from "src/pageComponents/job/ManageJobBillingTable";
import { PlatformOrTenantRadio } from "src/pageComponents/job/PlatformOrTenantRadio";
import { OnlineClustersStore } from "src/stores/OnlineClustersStore";
import { Head } from "src/utils/head";

const p = prefix("page.admin.jobBilling.");

export const AdminJobBillingTablePage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
    () => {
      const query = useQuerystring();
      const t = useI18nTranslateToString();

      const tenant = queryToString(query.tenant) || undefined;

      return (
        <div>
          <Head title={t(p("jobBillingPriceTable"))} />
          <PageTitle titleText={t(p("jobBillingPriceTable"))} />
          <AdminJobBillingTable tenant={tenant} />
        </div>
      );
    },
  );

export const AdminJobBillingTable: React.FC<{ tenant?: string }> = ({ tenant }) => {

  const t = useI18nTranslateToString();

  const { onlineClusters } = useStore(OnlineClustersStore);
  const currentOnlineClusterIds = Object.keys(onlineClusters);
  console.log("【currentOnlineClusterIds】", currentOnlineClusterIds);
  const { data, isLoading, reload } = useAsync({ promiseFn: useCallback(async () => {
    return await api.getBillingItems({ query: { tenant, activeOnly: false, currentOnlineClusterIds } });
  }, [tenant]) });

  return (
    <div>
      { currentOnlineClusterIds.length === 0 &&
        <div style={{ marginBottom: 20 }}>{t("common.noAvailableClusters")}</div>
      }
      <FilterFormContainer>
        <Form layout="inline">
          <Form.Item label={t(p("managementObject"))}>
            <PlatformOrTenantRadio
              value={tenant || null}
              onChange={(tenant) => Router.push({
                pathname: "/admin/jobBilling", query:  tenant ? { tenant } : undefined })}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={reload}>{t("common.fresh")}</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <ManageJobBillingTable
        data={data}
        loading={isLoading}
        tenant={tenant}
        reload={reload}
      />
    </div>
  );
};

export default AdminJobBillingTablePage;
