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

import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Account } from "@scow/protos/build/server/account";
import { AccountAffiliation, User } from "@scow/protos/build/server/user";
import { Static } from "@sinclair/typebox";
import { Button, Form, Input, Table, Tabs, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PlatformRoleSelector } from "src/components/PlatformRoleSelector";
import { TenantRoleSelector } from "src/components/TenantRoleSelector";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { UserRole } from "src/models/User";
import { type InitGetAccountsSchema } from "src/pages/api/init/getAccounts";

interface UserTableFilterForm {
  idOrName: string | undefined;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  loading: boolean;
  reload: () => void;
}

const p = prefix("pageComp.init.initUsersAndAccountsTable.");
const pCommon = prefix("common.");

const UserTable: React.FC<DataTableProps<User>> = ({ data, loading, reload }) => {

  const t = useI18nTranslateToString();

  const [ query, setQuery ] = useState<UserTableFilterForm>(() => {
    return { idOrName: undefined };
  });

  const [form] = Form.useForm<UserTableFilterForm>();

  const UserRoleI18nTexts = {
    [UserRole.USER]: t("userRoles.user"),
    [UserRole.OWNER]: t("userRoles.owner"),
    [UserRole.ADMIN]: t("userRoles.admin"),
  };

  const filterData = useMemo(() => {
    const idOrName = query.idOrName;
    if (idOrName === undefined) return data;

    return data?.filter((user) =>
      user.userId.includes(idOrName) || user.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
  }, [data, query.idOrName]);

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<UserTableFilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { idOrName } = await form.validateFields();
            setQuery({ idOrName: idOrName === "" ? undefined : idOrName });
          }}
        >
          <Form.Item label={t(p("idOrName"))} name="idOrName">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        loading={loading}
        dataSource={filterData}
        scroll={{ x: true }}
        bordered
        rowKey="userId"
      >
        <Table.Column dataIndex="userId" title={t(pCommon("userId"))} />
        <Table.Column dataIndex="name" title={t(pCommon("name"))} />
        <Table.Column<User>
          dataIndex="platformRoles"
          title={t(p("platformRole"))}
          width={200}
          render={(_, r) => (
            <PlatformRoleSelector roles={r.platformRoles} userId={r.userId} reload={reload} />
          )}
        />
        <Table.Column<User>
          dataIndex="tenantRoles"
          title={t(p("tenantRole"))}
          width={200}
          render={(_, r) => (
            <TenantRoleSelector roles={r.tenantRoles} userId={r.userId} reload={reload} />
          )}
        />
        <Table.Column
          dataIndex="accountAffiliations"
          title={t(p("accountAffiliation"))}
          render={(accounts: AccountAffiliation[]) => accounts
            .map((x) =>
              x.accountName +
                (x.role !== UserRole.USER ? `(${UserRoleI18nTexts[x.role]})` : ""),
            ).join(", ")}
        />
      </Table>
    </div>
  );
};

const AccountTable:
React.FC<DataTableProps<Static<typeof InitGetAccountsSchema["responses"]["200"][0]>>>
   = ({ data, loading }) => {

     const t = useI18nTranslateToString();

     return (
       <Table
         loading={loading}
         dataSource={data}
         scroll={{ x: true }}
         pagination={{
           showSizeChanger: true,
           defaultPageSize: DEFAULT_PAGE_SIZE,
         }}
         rowKey="accountName"
         bordered
       >
         <Table.Column dataIndex="accountName" title={t(pCommon("accountName"))} />
         <Table.Column<Account>
           dataIndex="ownerName"
           title={t(pCommon("owner"))}
           render={(_, r) => `${r.ownerName} (id: ${r.ownerId})`}
         />
       </Table>
     );
   };

const usersPromiseFn = async () => (await api.initGetUsers({})).users;
const accountsPromiseFn = async () => (await api.initGetAccounts({})).accounts;

export const InitUsersAndAccountsTable: React.FC = () => {

  const t = useI18nTranslateToString();

  const { data: usersData, isLoading: usersLoading, reload: usersReload } = useAsync({ promiseFn: usersPromiseFn });
  const {
    data: accountsData, isLoading: accountsLoading, reload: accountsReload,
  } = useAsync({ promiseFn: accountsPromiseFn });

  const reload = () => {
    usersReload();
    accountsReload();
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <FormLayout maxWidth={800}>
        <Typography.Paragraph>
          {t(p("defaultTenant"))}<span>{t(p("initAdmin"))}</span>。
        </Typography.Paragraph>
        <Typography.Paragraph>
          <span>{t(p("initAdmin"))}</span>{t(p("set"))}
        </Typography.Paragraph>
        <Tabs defaultActiveKey="user" tabBarExtraContent={<a onClick={reload}>{t(pCommon("fresh"))}</a>}>
          <Tabs.TabPane tab={t(pCommon("user"))} key="user">
            <UserTable data={usersData} loading={usersLoading} reload={usersReload} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t(pCommon("account"))} key="account">
            <AccountTable data={accountsData} loading={accountsLoading} reload={accountsReload} />
          </Tabs.TabPane>
        </Tabs>
      </FormLayout>
    </div>
  );

};
