import { ExclamationCircleOutlined } from "@ant-design/icons";
import { compareNullableNumber, compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { compareNumber } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { RefreshLink } from "@scow/lib-web/build/utils/refreshToken";
import { type AccountUserInfo } from "@scow/protos/build/server/user";
import { Static } from "@sinclair/typebox";
import { App, Divider, Popover, Space, Table, Tag } from "antd";
import { LinkProps } from "next/link";
import React, { Key, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { DisabledA } from "src/components/DisabledA";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n,useI18nTranslateToString } from "src/i18n";
import { DisplayedUserState, UserRole, UserStateInAccount } from "src/models/User";
import { AddUserButton } from "src/pageComponents/users/AddUserButton";
import { SetJobChargeLimitLink } from "src/pageComponents/users/JobChargeLimitModal";
import { type GetAccountUsersSchema } from "src/pages/api/users";
import { UserStore } from "src/stores/UserStore";
import { moneyToString } from "src/utils/money";

import { BatchOperationButton } from "./BatchOperationButton";

interface Props {
  data: Static<typeof GetAccountUsersSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
  update: () => void;
  accountName: string;
  canSetAdmin: boolean;
  getJobsPageUrl: (userId: string) => LinkProps["href"];
}

const p = prefix("pageComp.user.userTable.");
const pCommon = prefix("common.");

export const UserTable: React.FC<Props> = ({
  data, isLoading, reload, update, accountName, canSetAdmin,
}) => {

  const { setUser, user } = useStore(UserStore);
  const t = useI18nTranslateToString();

  const [selectedAccountUser, setSelectedAccountUser] = useState<AccountUserInfo[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  const languageId = useI18n().currentLanguage.id;

  const { message, modal } = App.useApp();

  const DisplayedUserStateTexts = {
    [DisplayedUserState.DISPLAYED_NORMAL]: <Tag color="success">{t(p("normal"))}</Tag>,
    [DisplayedUserState.DISPLAYED_QUOTA_EXCEEDED]: <Tag color="error">{t(p("quotaExceeded"))}</Tag>,
    [DisplayedUserState.DISPLAYED_BLOCKED]: <Tag color="error">{t(p("blocked"))}</Tag>,
  };

  const roleTags = {
    [UserRole.OWNER]: <Tag color="gold">{t(pCommon("owner"))}</Tag>,
    [UserRole.ADMIN]: <Tag color="blue">{t(p("admin"))}</Tag>,
    [UserRole.USER]: <Tag>{t(p("user"))}</Tag>,
  };

  // 如果移出自己操作成功，更新当前用户的账户关系
  const handleIfRemoveSelfFromAccount = (userId: string) => {
    setUser((prev) => {
      if (!prev || prev.identityId !== userId) return prev;
      if (!prev.accountAffiliations.some((a) => a.accountName === accountName)) return prev;

      return {
        ...prev,
        accountAffiliations: prev.accountAffiliations
          .filter((a) => a.accountName !== accountName),
      };
    });
  };

  // 如果取消自己的管理员权限成功，更新当前用户的账户关系
  const handleIfUnsetSelfAccountAdmin = (userId: string) => {
    setUser((prev) => {
      if (!prev || prev.identityId !== userId) return prev;
      if (!prev.accountAffiliations
        .some((a) => a.accountName === accountName && a.role === UserRole.ADMIN)) return prev;

      const updatedAffiliations = prev.accountAffiliations.map((a) =>
        a.accountName === accountName
          ? {
            ...a,
            role: UserRole.USER,
          }
          : a,
      );
      return {
        ...prev,
        accountAffiliations: updatedAffiliations,
      };
    });
  };

  return (
    <>
      <TableTitle>
        <Space split={<Divider type="vertical" />}>
          <AddUserButton
            refresh={reload}
            accountName={accountName}
            token={user?.token || ""}
            disabled={selectedKeys.length > 0}
          />
          <BatchOperationButton
            selectedAccountUser={selectedAccountUser}
            setSelectedAccountUser={setSelectedAccountUser}
            accountName={accountName}
            setSelectedKeys={setSelectedKeys}
            reload={reload}
          />
          <RefreshLink refresh={update} languageId={languageId} />
        </Space>
      </TableTitle>
      <Table
        dataSource={data?.results}
        loading={isLoading}
        rowKey="userId"
        scroll={{ x: true }}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
        rowSelection={{ type: "checkbox",
          onChange: (key, record) => {
            setSelectedKeys(key);
            setSelectedAccountUser(record);
          },
          selectedRowKeys: selectedKeys,
        }}
      >
        <Table.Column<AccountUserInfo>
          dataIndex="userId"
          title={t(pCommon("userId"))}
          sorter={(a, b) => compareNullableString(a.userId, b.userId)}
        />
        <Table.Column<AccountUserInfo>
          dataIndex="name"
          title={t(pCommon("name"))}
          sorter={(a, b) => compareNullableString(a.name, b.name)}
        />
        <Table.Column<AccountUserInfo>
          dataIndex="role"
          title={t(p("role"))}
          render={(r: UserRole) => roleTags[r]}
          sorter={(a, b) => compareNumber(a.role, b.role)}
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
          sorter={(a, b) => compareNullableNumber(a.status, b.status)}
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
            <Space size="middle">
              <SetJobChargeLimitLink
                accountName={accountName}
                reload={reload}
                usersInfo={[r]}
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
                      ${t(p("confirmUnsealText2"))}${r.name}（ID：${r.userId}）${t(p("confirmUnsealText3"))}`,
                        onOk: async () => {
                          await api.unblockUserInAccount({ body: {
                            userIds: [r.userId],
                            accountName: accountName,
                          } })
                            .then((res) => {
                              if (res.success) {
                                message.success(t(p("unsealSuccess")));
                              } else {
                                message.error(res.reason || t(p("unblockUserInAccountFailed")));
                              }
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
                            userIds: [r.userId],
                            accountName: accountName,
                          } })
                            .then((res) => {
                              if (res.success) {
                                message.success(t(p("blockSuccess")));
                              } else {
                                message.error(res.reason || t(p("blockUserInAccountFailed")));
                              }
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
                                handleIfUnsetSelfAccountAdmin(r.userId);
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
                        userIds: [r.userId],
                        accountName: accountName,
                      } })
                        .httpError(400, (e) => {
                          message.destroy("removeUser");
                          message.error({
                            content: `${t("page._app.multiClusterOpErrorContent")}(${
                              e.message
                            })`,
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
                          handleIfRemoveSelfFromAccount(r.userId);
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
    </>
  );
};
