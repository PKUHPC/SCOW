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

import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { App, Divider, Space } from "antd";
import { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { BackIcon } from "src/assets/headerIcons";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { AddUserButton } from "src/pageComponents/users/AddUserButton";
import { UserTable } from "src/pageComponents/users/UserTable";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const p = prefix("page.tenant.accounts.accountName.users.index.");

const TitleLinkContainer = styled.div`
    display: inline-flex;
    align-items: center;
    margin: 0 16px 0 8px;
`;

export const AccountUsersPage: NextPage = requireAuth(
  (i) => i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(
  ({ userStore }) => {
    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;

    const { message } = App.useApp();

    const router = useRouter();

    const accountName = queryToString(router.query.accountName);

    const promiseFn = useCallback(async () => {
      if (!accountName) { return undefined; }
      return await api.getAccountUsers({ query: {
        accountName,
      } })
        .httpError(403, () => {
          message.error(t(p("cannotManageUser"), [accountName]));
          return undefined;
        });
    }, [userStore.user]);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    const title = t(p("userInAccount"), [accountName]);

    return (
      <div>
        <Head title={title} />
        <PageTitle
          beforeTitle={(
            <TitleLinkContainer>
              <Link href="/tenant/accounts/list" legacyBehavior>
                <BackIcon />
              </Link>
            </TitleLinkContainer>
          )}
          titleText={title}
        >
          <Space split={<Divider type="vertical" />}>
            <AddUserButton refresh={reload} accountName={accountName} token={userStore.user.token} />
            <RefreshLink refresh={update} languageId={languageId} />
          </Space>
        </PageTitle>
        <UserTable
          canSetAdmin={true}
          reload={reload}
          accountName={accountName}
          data={data}
          isLoading={isLoading}
          getJobsPageUrl={(userId) => `/tenant/accounts/${accountName}/users/${userId}/jobs`}
        />
      </div>
    );
  });

export default AccountUsersPage;
