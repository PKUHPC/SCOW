import type { LockUsersInfo } from "src/pages/api/admin/getLockedUsers";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Table } from "antd";
import dayjs from "dayjs";
import { NextPage } from "next";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { UserSearchFilters, UserSearchForm } from "src/components/users/UserSearchForm";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { Head } from "src/utils/head";

const p = prefix("page.admin.lockedUsers.");
const pCommon = prefix("common.");
export const LockedUsersPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    const [query, setQuery] = useState<UserSearchFilters>({});

    const { message, modal } = App.useApp();

    const { data, isLoading, reload } = useAsync({
      promiseFn: useCallback(async () => {
        const param = {
          userId: query.userId,
          name: query.name,
        };
        return api.getLockedUsers({ query: param });
      }, [query]),
    });

    return (
      <div>
        <Head title={t(p("userUnlock"))} />
        <PageTitle titleText={t(p("userUnlock"))} />
        <UserSearchForm onSearch={setQuery} />
        <Table
          tableLayout="fixed"
          dataSource={data?.results}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
          }}
        >
          <Table.Column<LockUsersInfo> dataIndex="identityId" title={t("common.userId")} />
          <Table.Column<LockUsersInfo> dataIndex="name" title={t("common.name")} />
          <Table.Column<LockUsersInfo>
            dataIndex="pwdAccountLockedTime"
            title={t(p("lockedTime"))}
            render={(value) =>
              value
                ? dayjs(value.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")).format(
                    "YYYY-MM-DD HH:mm:ss",
                  )
                : ""
            }
          />
          <Table.Column<LockUsersInfo>
            dataIndex="operation"
            title={t(pCommon("operation"))}
            fixed="right"
            render={(_, r) => (
              <a
                onClick={() => {
                  modal.confirm({
                    title: t(p("confirmUlock")),
                    icon: <ExclamationCircleOutlined />,
                    content: `${t(p("confirmUlockText1"))}${r.name}（ID：${r.identityId}）
                  ${t(p("confirmUlockText2"))}(${t(p("oneChancetoLogin"))})`,
                    onOk: async () => {
                      await api
                        .unlockUser({ body: { identityId: r.identityId } })
                        .httpError(404, () => {
                          message.error(`${t(p("userNotFound"))}`);
                        })
                        .httpError(501, () => {
                          message.error("featureUnavailable");
                        })
                        .then(() => {
                          message.success(`${t(p("unlockSuccess"))}`);
                          reload();
                        })
                        .catch(() => {
                          message.error(`${t(p("unlockFail"))}`);
                        });
                    },
                  });
                }}
              >
                {t(p("unlockLogin"))}
              </a>
            )}
          />
        </Table>
      </div>
    );
  },
);

export default LockedUsersPage;
