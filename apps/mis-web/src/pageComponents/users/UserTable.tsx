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

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { type AccountUserInfo } from "@scow/protos/build/server/user";
import { Static } from "@sinclair/typebox";
import { App, Divider, Popover, Space, Table, Tag } from "antd";
import { LinkProps } from "next/link";
import React from "react";
import { api } from "src/apis";
import { DisabledA } from "src/components/DisabledA";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DisplayedUserState, UserRole, UserStateInAccount } from "src/models/User";
import { SetJobChargeLimitLink } from "src/pageComponents/users/JobChargeLimitModal";
import { GetAccountUsersSchema } from "src/pages/api/users";
import { moneyToString } from "src/utils/money";

interface Props {
  data: Static<typeof GetAccountUsersSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
  accountName: string;
  canSetAdmin: boolean;
  getJobsPageUrl: (userId: string) => LinkProps["href"];
}

const p = prefix("pageComp.user.userTable.");
const pCommon = prefix("common.");

export const UserTable: React.FC<Props> = ({
  data, isLoading, reload, accountName, canSetAdmin,
}) => {

  const t = useI18nTranslateToString();

  const DisplayedUserStateTexts = {
    [DisplayedUserState.DISPLAYED_NORMAL]: <Tag color="success">{t(p("normal"))}</Tag>,
    [DisplayedUserState.DISPLAYED_QUOTA_EXCEEDED]: <Tag color="error">{t(p("quotaExceeded"))}</Tag>,
    [DisplayedUserState.DISPLAYED_BLOCKED]: <Tag color="error">{t(p("block"))}</Tag>,
  };


  const roleTags = {
    [UserRole.OWNER]: <Tag color="gold">{t(pCommon("owner"))}</Tag>,
    [UserRole.ADMIN]: <Tag color="blue">{t(p("admin"))}</Tag>,
    [UserRole.USER]: <Tag>{t(p("user"))}</Tag>,
  };

  const { message, modal } = App.useApp();

  return (
    <Table
      dataSource={data?.results}
      loading={isLoading}
      rowKey="userId"
      scroll={{ x: true }}
      pagination={{
        showSizeChanger: true,
        defaultPageSize: DEFAULT_PAGE_SIZE,
      }}
    >
      <Table.Column<AccountUserInfo> dataIndex="userId" title={t(pCommon("userId"))} />
      <Table.Column<AccountUserInfo> dataIndex="name" title={t(pCommon("name"))} />
      <Table.Column<AccountUserInfo>
        dataIndex="role"
        title={t(p("role"))}
        render={(r: UserRole) => roleTags[r]}
      />
      <Table.Column<AccountUserInfo>
        dataIndex="displayedUserState"
        title={(
          <Space>
            {t(pCommon("status"))}
            <Popover
              title={t(p("statusExplanation"))}
              content={(
                <>
                  <span>{t(p("blockedExplanation"))}</span>
                  <br />
                  <span>{t(p("quotaExceededExplanation"))}</span>
                  <br />
                  <span>{t(p("normalExplanation"))}</span>
                </>
              )}
            >
              <ExclamationCircleOutlined />
            </Popover>
          </Space>
        )}
        render={(s) => DisplayedUserStateTexts[s]}
      />
      <Table.Column<AccountUserInfo>
        dataIndex="jobChargeLimit"
        title={t(p("alreadyUsed"))}
        render={(_, r) => r.jobChargeLimit && r.usedJobChargeLimit
          ? `${moneyToString(r.usedJobChargeLimit)} / ${moneyToString(r.jobChargeLimit)} ${t(pCommon("unit"))}`
          : t(p("none"))}
      />
      <Table.Column<AccountUserInfo>
        title={t(pCommon("operation"))}
        render={(_, r) => (
          <Space split={<Divider type="vertical" />}>
            <SetJobChargeLimitLink
              userId={r.userId}
              accountName={accountName}
              reload={reload}
              username={r.name}
              currentLimit={r.jobChargeLimit}
              currentUsed={r.usedJobChargeLimit}
              status={r.status}
            >
              {t(p("limitManage"))}
            </SetJobChargeLimitLink>
            {
              r.userStateInAccount === UserStateInAccount.BLOCKED_BY_ADMIN
                ? (
                  <a onClick={() => {
                    modal.confirm({
                      title: t(p("confirmNotBlock")),
                      icon: <ExclamationCircleOutlined />,
                      content: `${t(p("confirmUnsealText1"))}${accountName}
                      ${t(p("confirmUnsealText2"))}${r.name}（ID：${r.userId}${t(p("confirmUnsealText3"))}`,
                      onOk: async () => {
                        await api.unblockUserInAccount({ body: {
                          identityId: r.userId,
                          accountName: accountName,
                        } })
                          .then(() => {
                            message.success(t(p("unsealSuccess")));
                            reload();
                          });
                      },
                    });
                  }}
                  >
                    {t(p("unseal"))}
                  </a>
                ) : (
                  <a onClick={() => {
                    modal.confirm({
                      title: t(p("confirmBlock")),
                      icon: <ExclamationCircleOutlined />,
                      content: `${t(p("confirmBlockText1"))}${accountName}
                      ${t(p("confirmBlockText2"))}${r.name}（ID：${r.userId}）？`,
                      onOk: async () => {
                        await api.blockUserInAccount({ body: {
                          identityId: r.userId,
                          accountName: accountName,
                        } })
                          .then(() => {
                            message.success(t(p("blockSuccess")));
                            reload();
                          });
                      },
                    });
                  }}
                  >
                    {t(p("block"))}
                  </a>
                )
            }
            {
              canSetAdmin ? (
                r.role === UserRole.ADMIN
                  ? (
                    <a onClick={() => {
                      modal.confirm({
                        title: t(p("confirmCancelAdmin")),
                        icon: <ExclamationCircleOutlined />,
                        content: `${t(p("confirmCancelAdminText1"))}${r.name} （ID：${r.userId}）
                        ${t(p("confirmCancelAdminText2"))}${accountName}${t(p("confirmCancelAdminText3"))}`,
                        onOk: async () => {
                          await api.unsetAdmin({ body: {
                            identityId: r.userId,
                            accountName: accountName,
                          } })
                            .then(() => {
                              message.success(t(p("operateSuccess")));
                              reload();
                            });
                        },
                      });
                    }}
                    >
                      {t(p("cancelAdmin"))}
                    </a>
                  ) : r.role === UserRole.USER ? (
                    <a onClick={() => {
                      modal.confirm({
                        title: t(p("confirmGrantAdmin")),
                        icon: <ExclamationCircleOutlined />,
                        content: ` ${t(p("confirmGrantAdminText1"))}${r.name} （ID：${r.userId}）
                        ${t(p("confirmGrantAdminText2"))}${accountName}${t(p("confirmCancelAdminText3"))}`,
                        onOk: async () => {
                          await api.setAdmin({ body: {
                            identityId: r.userId,
                            accountName: accountName,
                          } })
                            .then(() => {
                              message.success(t(p("operateSuccess")));
                              reload();
                            });
                        },
                      });
                    }}
                    >
                      {t(p("grantAdmin"))}
                    </a>
                  ) : undefined
              ) : undefined
            }
            <DisabledA
              disabled={r.role === UserRole.OWNER}
              message={t(p("cannotRemove"))}
              onClick={() => {
                modal.confirm({
                  title: t(p("confirmRemove")),
                  icon: <ExclamationCircleOutlined />,
                  content: `${t(p("confirmRemoveText"))}${accountName}${t(p("removerUser"))}
                  ${r.name}（ID：${r.userId}）？`,
                  onOk: async () => {
                    message.open({
                      type: "loading",
                      content: t("common.waitingMessage"),
                      duration: 0,
                      key: "removeUser" });
                    await api.removeUserFromAccount({ query: {
                      identityId: r.userId,
                      accountName: accountName,
                    } })
                      .httpError(400, (e) => {
                        message.destroy("removeUser");
                        message.error({
                          content: e.message,
                          duration: 4,
                        });
                      })
                      .httpError(409, () => {
                        message.destroy("removeUser");
                        message.error({
                          content: t(p("cannotRemoverUserWhoHaveRunningJobFromAccount")),
                          duration: 4,
                        });
                        reload();
                      })
                      .then(() => {
                        message.destroy("removeUser");
                        message.success(t(p("removeSuccess")));
                        reload();
                      });
                  },
                });
              }}
            >
              {t(p("removerUser"))}
            </DisabledA>
          </Space>
        )}
      />
    </Table>
  );
};
