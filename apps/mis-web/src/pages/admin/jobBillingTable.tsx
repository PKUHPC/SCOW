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
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { PlatformRole } from "src/models/User";
import { EditableJobBillingTable } from "src/pageComponents/job/EditableJobBillingTable";
import { TenantSelector } from "src/pageComponents/tenant/TenantSelector";
import { Head } from "src/utils/head";

const AdminJobBillingTable: React.FC<{ tenant?: string }> = ({ tenant }) => {

  const { data, isLoading, reload } = useAsync({ promiseFn: useCallback(async () => {
    return await api.getBillingTable({ query: { tenant } }).then((x) => x.items);
  }, [tenant]) });

  return (
    <div>
      <FilterFormContainer>
        <Form layout="inline">
          <Form.Item label="租户">
            <TenantSelector
              placeholder="不选择来管理平台计算项"
              allowUndefined={true}
              value={tenant}
              onChange={(tenant) => Router.push({ pathname: "/admin/jobBillingTable", query: { tenant } })}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={reload}>刷新</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <EditableJobBillingTable tenant={tenant} reload={reload} data={data} loading={isLoading} />
    </div>
  );
};

export const AdminJobBillingTablePage: NextPage = 
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
    () => {
      const query = useQuerystring();

      const tenant = queryToString(query.tenant) || undefined;

      return (
        <div>
          <Head title="管理作业价格表" />
          <PageTitle titleText={"管理作业价格表"} />
          <AdminJobBillingTable tenant={tenant} />
        </div>
      );
    });

export default AdminJobBillingTablePage;
