import { ExclamationCircleOutlined, MenuOutlined } from "@ant-design/icons";
import { type AccountUserInfo } from "@scow/protos/build/server/user";
import { App, Button, Dropdown, MenuProps, Space } from "antd";
import React from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DisplayedUserState, UserRole, UserStateInAccount } from "src/models/User";
import { SetJobChargeLimitLink } from "src/pageComponents/users/JobChargeLimitModal";

interface Props {
  selectedAccountUser: AccountUserInfo[];
  accountName: string;
  setSelectedKeys: (keys: React.Key[]) => void;
  setSelectedAccountUser: (users: AccountUserInfo[]) => void;
  reload: () => void;
}

enum BatchType {
  LimitManage = "limitManage",
  Unseal = "unseal",
  Block = "block",
  RemoverUser = "removerUser",
}

const p = prefix("pageComp.user.userTable.");

export const BatchOperationButton: React.FC<Props> = ({ selectedAccountUser, accountName, setSelectedAccountUser,
  setSelectedKeys, reload }) => {

  const t = useI18nTranslateToString();

  const { message, modal } = App.useApp();

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    const userIds = selectedAccountUser.map((user) => user.userId);
    const formattedUsers = selectedAccountUser.map((user) => {
      return `${user.name}（ID：${user.userId}）`;
    });
    let displayedUsers: string;

    if (formattedUsers.length <= 5) {
      displayedUsers = formattedUsers.join("、");
    } else {
      displayedUsers = `${formattedUsers.slice(0, 5).join("、")} ${t(p("andOtherUsers"), [formattedUsers.length]) }`;
    }

    switch (e.key as BatchType) {
      case BatchType.Unseal:
        modal.confirm({
          title: t(p("confirmNotBlock")),
          icon: <ExclamationCircleOutlined />,
          content: `${t(p("confirmUnsealText1"))}${accountName}
                        ${t(p("confirmUnsealText2"))}${displayedUsers}${t(p("confirmUnsealText3"))}`,
          onOk: async () => {
            await api.unblockUserInAccount({ body: {
              userIds,
              accountName,
            } })
              .httpError(500, () => { message.error(t(p("batchUnsealFailed"))); })
              .then((res) => {
                if (res.success) {
                  message.success(t(p("batchUnsealSuccess")));
                } else {
                  if (res.reason) {
                    message.error(res.reason);
                  } else {
                    const faileduserIds = res.results?.filter(
                      (result) => result.success === false).map((r) => r.userId);
                    message.error(t(p("batchUnsealCompleted"), [faileduserIds?.join(",")]));
                  }
                }

                setSelectedAccountUser([]);
                setSelectedKeys([]);
                reload();
              });
          },
        });
        break;
      case BatchType.Block:
        modal.confirm({
          title: t(p("confirmBlock")),
          icon: <ExclamationCircleOutlined />,
          content: `${t(p("confirmBlockText1"))}${accountName}
                        ${t(p("confirmBlockText2"))}${displayedUsers}？`,
          onOk: async () => {
            await api.blockUserInAccount({ body: {
              userIds,
              accountName,
            } })
              .httpError(500, () => { message.error(t(p("batchBlockFailed"))); })
              .then((res) => {
                if (res.success) {
                  message.success(t(p("batchBlockSuccess")));
                } else {
                  const faileduserIds = res.results?.filter((result) => result.success === false).map((r) => r.userId);
                  message.error(res.reason || t(p("batchBlockCompleted"), [faileduserIds?.join(",")]));
                }

                setSelectedAccountUser([]);
                setSelectedKeys([]);
                reload();
              });
          },
        });
        break;
      case BatchType.RemoverUser:
        modal.confirm({
          title: t(p("confirmRemove")),
          icon: <ExclamationCircleOutlined />,
          content: `${t(p("confirmRemoveText"))}${accountName}${t(p("removerUser"))}
                    ${displayedUsers}？`,
          onOk: async () => {
            message.open({
              type: "loading",
              content: t("common.waitingMessage"),
              duration: 0,
              key: "removeUser" });
            await api.removeUserFromAccount({ query: {
              userIds,
              accountName,
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
              .httpError(500, () => {
                message.destroy("removeUser");
                message.error({
                  content: t(p("batchRemoveFailed")),
                  duration: 4,
                });
              })
              .then((res) => {
                if (res.success) {
                  message.destroy("removeUser");
                  message.success(t(p("batchRemoveSuccess")));
                } else {
                  const faileduserIds = res.results?.filter((result) => result.success === false).map((r) => r.userId);
                  message.destroy("removeUser");
                  message.error(t(p("batchRemoveCompleted"), [faileduserIds?.join(",")]));
                }

                setSelectedAccountUser([]);
                setSelectedKeys([]);
                reload();
              });
          },
        });
        break;
    }
  };

  const getMenuItems = (): MenuProps["items"] => {
    let removeUserDisabled = false;
    let blockDisabled = false;
    let unsealDisabled = false;

    selectedAccountUser.forEach((user) => {
      if (user.role === UserRole.OWNER) {
        removeUserDisabled = true;
      }
      if (user.userStateInAccount === UserStateInAccount.BLOCKED_BY_ADMIN) {
        blockDisabled = true;
      }
      if (user.userStateInAccount === UserStateInAccount.NORMAL
          || user.displayedUserState === DisplayedUserState.DISPLAYED_QUOTA_EXCEEDED) {
        unsealDisabled = true;
      }
    });
    return [
      {
        label:
          <SetJobChargeLimitLink
            accountName={accountName}
            reload={reload}
            usersInfo={selectedAccountUser}
            setSelectedKeys={setSelectedKeys}
            setSelectedAccountUser={setSelectedAccountUser}
            batchFlag={true}
          >
            {t(p("limitManage"))}
          </SetJobChargeLimitLink>,
        key: BatchType.LimitManage,
      },
      {
        label: t(p("block")),
        key: BatchType.Block,
        disabled: blockDisabled,
      },
      {
        label: t(p("unseal")),
        key: BatchType.Unseal,
        disabled: unsealDisabled,
      },
      {
        label: t(p("removerUser")),
        key: BatchType.RemoverUser,
        disabled: removeUserDisabled,
      },
    ];
  };

  const menuProps = {
    items: getMenuItems(),
    onClick: handleMenuClick,
  };

  return (
    <Dropdown menu={menuProps} trigger={["click"]} disabled={selectedAccountUser.length === 0}>
      <Button icon={<MenuOutlined />}>
        <Space>
          {t(p("batchOperation"))}
        </Space>
      </Button>
    </Dropdown>
  );
};
