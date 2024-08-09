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

import { moneyToNumber } from "@scow/lib-decimal";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Descriptions, Tag } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { USE_MOCK } from "src/apis/useMock";
import { requireAuth } from "src/auth/requireAuth";
import { ssrAuthenticate, SSRProps } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { DisplayedAccountState, getDisplayedStateI18nTexts, UserRole } from "src/models/User";
import {
  checkQueryAccountNameIsAdmin } from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { getAccounts } from "src/pages/api/tenant/getAccounts";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

type Props = SSRProps<{
  accountName: string;
  ownerName: string;
  ownerId: string;
  balance: number;
  blocked: boolean;
  displayedState: DisplayedAccountState;
  blockThresholdAmount: number
}, 404>;

export const AccountInfoPage: NextPage<Props> = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)((props: Props) => {

  const t = useI18nTranslateToString();

  const DisplayedStateI18nTexts = getDisplayedStateI18nTexts(t);

  if ("error" in props) {
    return <UnifiedErrorPage code={props.error} />;
  }

  const { accountName, balance, ownerId, ownerName, displayedState, blockThresholdAmount } = props;
  const title = t("common.accountInfo");

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title} />
      <Descriptions bordered column={1}>
        <Descriptions.Item label={t("common.accountName")}>
          {accountName}
        </Descriptions.Item>
        <Descriptions.Item label={t("common.accountOwner")}>
          {ownerName}（ID：{ownerId}）
        </Descriptions.Item>
        <Descriptions.Item label={t("common.accountStatus")}>
          <Tag color={ displayedState === DisplayedAccountState.DISPLAYED_NORMAL ? "green" : "red"}>
            {DisplayedStateI18nTexts[displayedState]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t("common.accountBalance")}>
          {balance.toFixed(publicConfig.CHARGE_PRECISION)} {t("common.unit")}
        </Descriptions.Item>
        <Descriptions.Item label={t("common.blockThresholdAmount")}>
          {blockThresholdAmount.toFixed(publicConfig.CHARGE_PRECISION)} {t("common.unit")}
        </Descriptions.Item>
      </Descriptions>

    </div>
  );
});


export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {


  const accountName = queryToString(ctx.query.accountName);

  if (USE_MOCK) {
    return { props: {
      accountName,
      balance: 10.23,
      ownerId: "ownerId",
      ownerName: "123",
      blocked: true,
      displayedState: DisplayedAccountState.DISPLAYED_BLOCKED,
      blockThresholdAmount: 1.23,
    } };
  }

  const auth = ssrAuthenticate((i) => i.accountAffiliations.some((x) =>
    x.accountName === accountName && x.role !== UserRole.USER));

  const info = await auth(ctx.req);

  if (typeof info === "number") {
    return { props: { error: info } };
  }

  const accounts = await getAccounts({ accountName, tenantName: info.tenant });

  if (accounts.length === 0) {
    return { props: { error: 404 } };
  }

  const account = accounts[0];
  return { props: {
    balance: moneyToNumber(account.balance),
    accountName,
    ownerId: account.ownerId,
    ownerName: account.ownerName,
    blocked: account.blocked,
    displayedState: account.displayedState,
    blockThresholdAmount: moneyToNumber(account.blockThresholdAmount ?? account.defaultBlockThresholdAmount),
  } };


};

export default AccountInfoPage;
