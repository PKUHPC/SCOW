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

import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { queryToString, useQuerystring } from "@scow/lib-web/build/utils/querystring";
import { ClusterAccountInfo, ImportUsersData, UserInAccount } from "@scow/protos/build/server/admin";
import { App, Button, Checkbox, Drawer, Form, Select, Space, Table, Tooltip } from "antd";
import Router from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ClusterAccountInfo_ImportStatus } from "src/models/User";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";

const p = prefix("pageComp.admin.ImportUsersTable.");
const pCommon = prefix("common.");

export const ImportUsersTable: React.FC = () => {

  const t = useI18nTranslateToString();

  const { message, modal } = App.useApp();

  const qs = useQuerystring();

  const { activatedClusters, defaultCluster } = useStore(ClusterInfoStore);

  if (!defaultCluster && Object.keys(activatedClusters).length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const clusterParam = queryToString(qs.cluster);
  const cluster = (activatedClusters[clusterParam]
    ? activatedClusters[clusterParam]
    : defaultCluster);

  if (!cluster) {
    return <ClusterNotAvailablePage />;
  }

  const [form] = Form.useForm<{ whitelist: boolean }>();

  const [loading, setLoading] = useState(false);

  const promiseFn = useCallback(async () => {
    return await api.getClusterUsers({ query: {
      cluster: cluster.id,
    },
    })
      .httpError(409, (e) => {
        if (e.code === "FAILED_PRECONDITION" || e.code === "UNIMPLEMENTED") {
          modal.error({
            title: t(p("errorMessage")),
            content: e.message,
          });
        } else {
          throw e;
        }
      })
      .then((data) => ({
        accounts: data?.accounts?.map((account) => ({
          // 如果账户未导入，维持指定一个拥有者的逻辑确保导入用户时选择默认拥有者提交有效
          // 如果账户已导入，则获取数据库中的拥有者数据，如因特殊原因导致已没有拥有者，则显示“-”
          owner: account.importStatus === ClusterAccountInfo_ImportStatus.NOT_EXISTING
            ? account.users[0]?.userId : (account.owner ?? "-"),
          ...account,
        })),
      }));
  }, [cluster]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  useEffect(() => {
    form.setFieldsValue({
      whitelist: true,
    });
  }, [data]);

  const [selectedAccounts, setSelectedAccounts] = useState<ClusterAccountInfo[]>();
  const [usersList, setusersList] = useState<UserInAccount[] | undefined>(undefined);

  return (
    <div>

      <Form
        form={form}
        onFinish={async () => {
          if (!data) return;

          setLoading(true);

          const { whitelist } = await form.validateFields();
          const importData = selectedAccounts?.filter(
            (a) => a.importStatus !== ClusterAccountInfo_ImportStatus.EXISTING,
          );

          if (!importData || importData.length === 0) {
            message.info(t(p("selectAccount")));
            setLoading(false);
            return;
          }

          if (!importData.every((account) =>
            account.importStatus !== ClusterAccountInfo_ImportStatus.NOT_EXISTING ||
            account.owner,
          )) {
            message.error(t(p("specifyOwner")));
            setLoading(false);
            return;
          }

          await api.importUsers({ body: {
            data: {
              accounts: importData?.map((x) => ({
                accountName: x.accountName,
                users: x.users,
                // 导入时如果在SCOW中不存在的账户，必须指定owner
                owner: x.importStatus === ClusterAccountInfo_ImportStatus.NOT_EXISTING ? x.owner! : undefined,
                blocked: x.blocked,
              })),
            } as ImportUsersData,
            whitelist,
          } })
            .httpError(400, () => { message.error(t(p("incorrectFormat"))); })
            .httpError(409, () => { message.error(t("common.accountUserSyncRunning")); })
            .then(() => {
              setSelectedAccounts([]);
              message.success(t(p("importSuccess")));
            })
            .finally(() => {
              setLoading(false);
              reload();
            });
        }}
      >
        <FilterFormContainer>
          <Space align="center">
            {t(p("selectCluster"))}
            <SingleClusterSelector
              value={cluster}
              onChange={(value) => {
                Router.push({ query: { cluster: value.id } });
              }}
            />

            <Form.Item name="whitelist" valuePropName="checked">
              <Checkbox>{t(p("addWhitelist"))}</Checkbox>
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={loading}>
              {t(pCommon("import"))}
            </Button>
            <a onClick={reload}>
              {t(pCommon("fresh"))}
            </a>
          </Space>
        </FilterFormContainer>
        <Table
          rowSelection={{
            type: "checkbox",
            renderCell(_checked, record, _index, node) {
              if (record.importStatus === ClusterAccountInfo_ImportStatus.EXISTING) {
                return <Tooltip title={t(p("alreadyExist"))}>{node}</Tooltip>;
              } else if (record.importStatus === ClusterAccountInfo_ImportStatus.NOT_EXISTING) {
                return <Tooltip title={t(p("notExist"))}>{node}</Tooltip>;
              } else if (record.importStatus === ClusterAccountInfo_ImportStatus.HAS_NEW_USERS) {
                return <Tooltip title={t(p("partNotExist"))}>{node}</Tooltip>;
              }
            },
            getCheckboxProps: (r) => ({
              disabled: r.importStatus === ClusterAccountInfo_ImportStatus.EXISTING,
            }),
            onChange: (_, sr) => {
              setSelectedAccounts(sr);
            },
          }}
          loading={isLoading}
          dataSource={data?.accounts}
          scroll={{ x:true }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
          }}
          rowKey="accountName"
          bordered
        >
          <Table.Column dataIndex="accountName" title={t(pCommon("accountName"))} />
          <Table.Column<ClusterAccountInfo>
            dataIndex="owner"
            title={t(pCommon("owner"))}
            render={(_, r) => {
              return r.importStatus === ClusterAccountInfo_ImportStatus.NOT_EXISTING
                ? selectedAccounts?.includes(r)
                  ? (
                    // 管理系统导入账户时, 在没有拥有者的情况下账户拥有者默认选择账户的第一个用户
                    <Select
                      defaultValue={r.owner || r.users[0]?.userId}
                      options={r.users.map((user) => ({ value: user.userId, label: user.userId }))}
                      style={{ width: "100%" }}
                      placeholder={t(p("selectOwner"))}
                      onChange={(value) => {
                        r.owner = value;
                      }}
                    />
                  )
                  : ""
                : r.owner;
            }
            }

          />
          <Table.Column<ClusterAccountInfo>
            dataIndex="importStatus"
            title={t(p("importStatus"))}
            render={(value) => {
              if (value === ClusterAccountInfo_ImportStatus.EXISTING) {
                return t(p("alreadyImport"));
              } else if (value === ClusterAccountInfo_ImportStatus.HAS_NEW_USERS) {
                return t(p("partImport"));
              } else {
                return t(p("notImport"));
              }
            }}
          />
          <Table.Column<ClusterAccountInfo>
            dataIndex="users"
            title={t(p("userList"))}
            render={(_, r) => (
              <a onClick={() => setusersList(r.users)}>{t("common.view")}</a>
            )}
          />
        </Table>

        <Drawer
          placement="right"
          onClose={() => setusersList(undefined)}
          open={usersList !== undefined}
          title={t(p("userList"))}
        >
          <Table
            dataSource={usersList}
          >
            <Table.Column dataIndex="userId" title={t(pCommon("userId"))} />
          </Table>
        </Drawer>
      </Form>
    </div>
  );
};
