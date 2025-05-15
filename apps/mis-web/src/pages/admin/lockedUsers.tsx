import { ExclamationCircleOutlined } from "@ant-design/icons";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, Form, Input, Table } from "antd";
import dayjs from "dayjs";
import { NextPage } from "next";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import type { LockUsersInfo } from "src/pages/api/admin/getLockedUsers";
import { Head } from "src/utils/head";

const p = prefix("page.admin.lockedUsers.");
const pCommon = prefix("common.");

export const LockedUsersPage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(() => {
    const t = useI18nTranslateToString();

    const [form] = Form.useForm();

    const [query, setQuery] = useState<{
      userId: string | undefined,
    }>(() => ({
      userId: "",
    }));

    const { message, modal } = App.useApp();

    const { data, isLoading, reload } = useAsync({
      promiseFn: useCallback(async () => {
        const param = {
          userId: query.userId,
        };
        return api.getLockedUsers({ query: param });

      }, [query]),
    });

    return (
      <div>
        <Head title={t(p("userUnlock"))} />
        <PageTitle titleText={t(p("userUnlock"))} />
        <FilterFormContainer>
          <Form
            layout="inline"
            form={form}
            onFinish={async () => {
              const { userId } = await form.validateFields();
              setQuery({
                userId: userId,
              });
            }}
          >
            <Form.Item label={t("common.userId")} name="userId">
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
            </Form.Item>
          </Form>
        </FilterFormContainer>
        <Table
          tableLayout="fixed"
          dataSource={data?.results}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
          }}
        >
          <Table.Column<LockUsersInfo>
            dataIndex="identityId"
            title={t("common.userId")}
          />
          <Table.Column<LockUsersInfo>
            dataIndex="name"
            title={t("common.name")}
          />
          <Table.Column<LockUsersInfo>
            dataIndex="pwdAccountLockedTime"
            title={t(p("lockedTime"))}
            render={(value) => (
              value ? dayjs(value.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"))
                .format("YYYY-MM-DD HH:mm:ss") : ""
            )}
          />
          <Table.Column<LockUsersInfo>
            dataIndex="operation"
            title={t(pCommon("operation"))}
            fixed="right"
            render={(_, r) => (
              <a onClick={() => {
                modal.confirm({
                  title: t(p("confirmUlock")),
                  icon: <ExclamationCircleOutlined />,
                  content: `${t(p("confirmUlockText1"))}${r.name}（ID：${r.identityId}）
                    ${t(p("confirmUlockText2"))}(${t(p("oneChancetoLogin"))})`,
                  onOk: async () => {
                    await api.unlockUser({ body: { identityId: r.identityId } })
                      .httpError(404, () => { message.error(`${t(p("userNotFound"))}`); })
                      .httpError(501, () => { message.error("featureUnavailable"); })
                      .then(() => {
                        message.success(`${t(p("unlockSuccess"))}`);
                        reload();
                      })
                      .catch(() => { message.error(`${t(p("unlockFail"))}`); });
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
  });

export default LockedUsersPage;

