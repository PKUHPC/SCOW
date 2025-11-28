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

import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { Divider, Space } from "antd";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { UserRole } from "src/models/User";
import { useAccountPagesAccountName } from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { AddUserButton } from "src/pageComponents/users/AddUserButton";
import { UserTable } from "src/pageComponents/users/UserTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.users.");

export const UsersPage: NextPage = requireAuth(
  (i) => i.accountAffiliations.some((x) => x.role !== UserRole.USER),
)(
  ({ userStore }) => {

    const accountName = useAccountPagesAccountName();
    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;

    const account = userStore.user.accountAffiliations.find((x) => x.accountName === accountName);
    // 如果因为管理员自己取消了自己的管理权限或者在账户下移出了自己
    // 当前账户已不在登录用户的账户关联关系下，或者权限已不是拥有者或管理员
    // 则返回错误页面
    if (!account || account.role === UserRole.USER) {
      return <NotFoundPage />;
    }

    const promiseFn = useCallback(async () => {
      return await api.getAccountUsers({ query: {
        accountName,
      } });
    }, [accountName]);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    const title = t(p("title"), [accountName]);

    return (
      <div>
        <Head title={title} />
        <PageTitle
          titleText={title}
        >
          <Space split={<Divider type="vertical" />}>
            {
              publicConfig.ADD_USER_TO_ACCOUNT.accountAdmin.allowed && (
                <AddUserButton
                  refresh={reload}
                  accountName={account.accountName}
                  token={userStore.user.token}
                  canCreateUserIfNotExist={
                    (account.role === UserRole.OWNER || account.role === UserRole.ADMIN) &&
                    publicConfig.ADD_USER_TO_ACCOUNT.accountAdmin.createUserIfNotExist
                  }
                />
              )
            }

            <RefreshLink refresh={update} languageId={languageId} />
          </Space>
        </PageTitle>
        <UserTable
          data={data}
          isLoading={isLoading}
          reload={reload}
          accountName={accountName}
          canSetAdmin={account.role === UserRole.OWNER}
          getJobsPageUrl={(userId) => ({
            pathname: `/accounts/${accountName}/userJobs`,
            query: { userId },
          })}
        />
      </div>
    );
  });

export default UsersPage;
