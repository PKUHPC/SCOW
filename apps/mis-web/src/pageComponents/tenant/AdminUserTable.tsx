
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Input, Space, Table, Tooltip } from "antd";
import { SortOrder } from "antd/es/table/interface";
import React, { useCallback, useMemo, useState } from "react";
import { api } from "src/apis";
import { ChangePasswordIcon, DeleteIcon, DetailIcon, EditIcon } from "src/assets/operationIcon";
import { ChangePasswordModalLink } from "src/components/ChangePasswordModal";
import { DeleteEntityFailedModal } from "src/components/DeleteEntityFailedModal";
import { DeleteEntityModalLink } from "src/components/DeleteEntityModal";
import { DisabledA } from "src/components/DisabledA";
import { EditUserProfileModalLink } from "src/components/EditUserProfileModal";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { TenantRoleSelector } from "src/components/TenantRoleSelector";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import { AccountState,DeleteFailedReason, FullUserInfo, TenantRole, UserState } from "src/models/User";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { TenantUserInfoDrawer } from "src/pageComponents/users/TenantUserInfoDrawer";
import { type GetTenantUsersSchema } from "src/pages/api/admin/getTenantUsers";
import { User } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { getRuntimeI18nConfigText } from "src/utils/config";

interface Props {
  data: Static<typeof GetTenantUsersSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
  user: User;
}

interface FilterForm {
  idOrName: string | undefined;
}

const p = prefix("pageComp.tenant.adminUserTable.");
const pCommon = prefix("common.");
const pDelete = prefix("component.deleteModals.");

const filteredRoles = {
  "ALL_USERS": "allUsers",
  "TENANT_ADMIN": "tenantAdmin",
  "TENANT_FINANCE": "tenantFinance",
} as const;
type FilteredRole = keyof typeof filteredRoles;


const deleteEnabled = publicConfig.DELETE_USER_CONFIG?.misConfig?.enabled ?? false;

export const AdminUserTable: React.FC<Props> = ({
  data, isLoading, reload, user,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();
  const [form] = Form.useForm<FilterForm>();

  const [query, setQuery] = useState<FilterForm>({
    idOrName: undefined,
  });

  const [previewItem, setPreviewItem] = useState<FullUserInfo | undefined>(undefined);
  const [rangeSearchRole, setRangeSearchRole] = useState<FilteredRole>("ALL_USERS");
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [currentSortInfo, setCurrentSortInfo] =
    useState<{ field: string | null | undefined, order: SortOrder }>({ field: null, order: null });

  const filteredData = useMemo(() => data ? data.results.filter((x) => (
    (!query.idOrName || x.id.includes(query.idOrName) || x.name.includes(query.idOrName))
    && (rangeSearchRole === "ALL_USERS" || x.tenantRoles.includes(
      rangeSearchRole === "TENANT_ADMIN" ? TenantRole.TENANT_ADMIN : TenantRole.TENANT_FINANCE))
  ))
    .map((x) => ({
      ...x,
      accountAffiliations: x.accountAffiliations.filter((acc) => acc.accountState !== AccountState.DELETED),
    }))
    : undefined, [data, query, rangeSearchRole],
  );

  const searchData = useMemo(() => data ? data.results.filter((x) => (
    !query.idOrName || x.id.includes(query.idOrName) || x.name.includes(query.idOrName)
  )) : undefined, [data, query]);


  const getUsersRoleCount = useCallback((role: FilteredRole): number => {

    switch (role) {
      case "TENANT_ADMIN":
        return searchData
          ? searchData.filter((user) => user.tenantRoles.includes(TenantRole.TENANT_ADMIN)).length : 0;
      case "TENANT_FINANCE":
        return searchData
          ? searchData.filter((user) => user.tenantRoles.includes(TenantRole.TENANT_FINANCE)).length : 0;
      case "ALL_USERS":
      default:
        return searchData ? searchData.length : 0;
    }
  }, [searchData]);

  const handleTableChange = (_, __, sortInfo) => {
    setCurrentSortInfo({ field: sortInfo.field, order: sortInfo.order });
  };

  // 切换用户角色时重置页码到首页，重置排序信息
  const handleFilterRoleChange = (role: FilteredRole) => {
    setRangeSearchRole(role);
    setCurrentPageNum(1);
    setCurrentSortInfo({ field: null, order: null });
  };

  const handleExport = async (columns: string[], encoding: Encoding) => {
    // 获取浏览器时区
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const total = filteredData?.length ?? 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      window.location.href = urlToExport({
        encoding,
        exportApi: "exportUser",
        columns,
        count: total,
        query: {
          idOrName: query.idOrName,
          selfTenant: true,
          tenantRole: rangeSearchRole === "TENANT_ADMIN"
            ? TenantRole.TENANT_ADMIN
            : rangeSearchRole === "TENANT_FINANCE"
              ? TenantRole.TENANT_FINANCE : undefined,
        },
        timeZone:timeZone,
      });
    }

  };

  const exportOptions = useMemo(() => {
    return [
      { label: t(pCommon("userId")), value: "userId" },
      { label: t(p("name")), value: "name" },
      { label: t(pCommon("email")), value: "email" },
      { label: t(pCommon("phone")), value: "phone" },
      { label: t(pCommon("organization")), value: "organization" },
      { label: t(p("tenantRole")), value: "tenantRoles" },
      { label: t(p("affiliatedAccountName")), value: "affiliatedAccounts" },
      { label: t(pCommon("comment")), value: "adminComment" },
      { label: t(pCommon("createTime")), value: "createTime" },
    ];
  }, [t]);

  const [failedModalVisible, setFailedModalVisible] = useState(false);
  const [failedDeletedMessage, setFailedDeletedMessage] = useState({
    type: DeleteFailedReason.ACCOUNTS_OWNER,
    userId: "",
    accounts: [],
  });

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          // 搜索结束时重置页码到首页，重置排序信息
          onFinish={async () => {
            setQuery(await form.validateFields());
            setCurrentPageNum(1);
            setCurrentSortInfo({ field: null, order: null });
          }}
        >
          <Form.Item label={t(p("idOrName"))} name="idOrName">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
          </Form.Item>
          <Form.Item>
            <ExportFileModaLButton
              options={exportOptions}
              onExport={handleExport}
            >
              {t(pCommon("export"))}
            </ExportFileModaLButton>
          </Form.Item>
        </Form>
        <Space style={{ marginBottom: "-16px" }}>
          <FilterFormTabs
            tabs={Object.keys(filteredRoles).map((role) => ({
              title: `${t(p(filteredRoles[role]))}(${getUsersRoleCount(role as FilteredRole)})`,
              key: role,
            }))}
            onChange={(value) => handleFilterRoleChange(value as FilteredRole)}
          />
        </Space>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          current: currentPageNum,
          onChange: (page) => setCurrentPageNum(page),
        }}
        rowKey="id"
        scroll={{ x: filteredData?.length ? 1600 : true }}
        onChange={handleTableChange}
      >
        <Table.Column<FullUserInfo>
          dataIndex="id"
          title={t(pCommon("userId"))}
          width="300px"
          sorter={(a, b) => a.id.localeCompare(b.id)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "id" ? currentSortInfo.order : null}
        />
        <Table.Column<FullUserInfo>
          dataIndex="name"
          title={t(p("name"))}
          sorter={(a, b) => a.name.localeCompare(b.name)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "name" ? currentSortInfo.order : null}
        />
        <Table.Column<FullUserInfo>
          dataIndex="email"
          title={t(pCommon("email"))}
          width={300}
          sorter={(a, b) => a.email.localeCompare(b.email)}
          sortDirections={["ascend", "descend"]}
          sortOrder={currentSortInfo.field === "email" ? currentSortInfo.order : null}
        />
        <Table.Column<FullUserInfo>
          dataIndex="phone"
          title={t(pCommon("phone"))}
          width={200}
          render={(_, r) => r.phone ?? ""}
        />
        <Table.Column<FullUserInfo>
          dataIndex="organization"
          title={t(pCommon("organization"))}
          render={(_, r) => r.organization ?? ""}
        />
        <Table.Column<FullUserInfo>
          dataIndex="tenantRoles"
          title={t(p("tenantRole"))}
          render={(_, r) => (
            <TenantRoleSelector
              reload={reload}
              roles={r.tenantRoles}
              userId={r.id}
              currentUser={user}
              isDisabled={r.state === UserState.DELETED}
            />
          )}
        />
        <Table.Column<FullUserInfo>
          dataIndex="operation"
          title={t(pCommon("operation"))}
          width="300px"
          fixed="right"
          render={(_, r) => (
            <Space split={<Divider type="vertical" />}>
              <Tooltip title={t(p("detail"))}>
                <DetailIcon onClick={() => setPreviewItem(r)} />
              </Tooltip>
              {r.state === UserState.DELETED ? (
                <DisabledA message={t(pDelete("userDeleted"))} disabled={true}>
                  <EditIcon disabled />
                </DisabledA>
              ) : (
                <EditUserProfileModalLink
                  userId={r.id}
                  name={r.name}
                  email={r.email}
                  phone={r.phone ?? ""}
                  organization={r.organization ?? ""}
                  adminComment={r.adminComment ?? ""}
                  onComplete={async (newUserInfo) => {
                    await api.editUserProfile({
                      body: {
                        identityId: r.id,
                        tenantName: r.tenant,
                        email: newUserInfo.email,
                        phone: newUserInfo.phone,
                        organization: newUserInfo.organization,
                        adminComment: newUserInfo.adminComment,
                      },
                    })
                      .httpError(404, () => { message.error(t(p("notExist"))); })
                      .httpError(500, (e) => { message.error(e.message); })
                      .httpError(501, () => { message.error("featureUnavailable"); })
                      .then(() => { message.success(t(p("editUserProfileSuccess"))); })
                      .catch(() => { message.error(t(p("editUserProfileError"))); })
                      .finally(() => reload());
                  }}
                >
                  <Tooltip title={t(pCommon("edit"))}>
                    <EditIcon />
                  </Tooltip>
                </EditUserProfileModalLink>
              )}
              {r.state === UserState.DELETED ? (
                <DisabledA message={t(pDelete("userDeleted"))} disabled={true}>
                  <ChangePasswordIcon disabled />
                </DisabledA>
              ) : (
                <ChangePasswordModalLink
                  userId={r.id}
                  name={r.name}
                  onComplete={async (newPassword) => {
                    await api.changePasswordAsTenantAdmin({
                      body: {
                        identityId: r.id,
                        newPassword: newPassword,
                      },
                    })
                      .httpError(404, () => { message.error(t(p("notExist"))); })
                      .httpError(501, () => { message.error(t(p("notAvailable"))); })
                      .httpError(400, (e) => {
                        if (e.code === "PASSWORD_NOT_VALID") {
                          message.error(getRuntimeI18nConfigText(languageId, "passwordPatternMessage"));
                        };
                      })
                      .then(() => {
                        message.success(t(p("changeSuccess")));
                        api.updatePasswordResetFlag({
                          body: {
                            userId: r.id,
                            forceFlag: true,
                          },
                        }).catch((e) => { console.log(e, "err"); });
                      })
                      .catch(() => { message.error(t(p("changeFail"))); });
                  }}
                >
                  <Tooltip title={t(p("changePassword"))}>
                    <ChangePasswordIcon />
                  </Tooltip>
                </ChangePasswordModalLink>
              )
              }
              { deleteEnabled === true ? r.platformRoles.includes(0) ? (
                <DisabledA message={t(pDelete("platformAdmin"))} disabled={true}>
                  <DeleteIcon disabled />
                </DisabledA>
              ) : user.identityId === r.id ? (
                <DisabledA message={t(pDelete("cannotDeleteSelf"))} disabled={true}>
                  <DeleteIcon disabled />
                </DisabledA>
              ) : r.state === UserState.DELETED ? (
                <DisabledA message={t(pDelete("userDeleted"))} disabled={true}>
                  <DeleteIcon disabled />
                </DisabledA>
              ) : (
                <DeleteEntityModalLink
                  id={r.id}
                  name={r.name}
                  type="USER"
                  onComplete={async (inputUserId, inputUserName, comments) => {

                    message.open({
                      type: "loading",
                      content: t("common.waitingMessage"),
                      duration: 0,
                      key: "deleteUser" });

                    await api.deleteUser({ query: {
                      userId:inputUserId,
                      userName:inputUserName,
                      comments: comments,
                    } })
                      .httpError(404, (e) => {
                        message.destroy("deleteUser");
                        message.error({
                          content: e.message,
                          duration: 4,
                        });
                      })
                      .httpError(409, (e) => {
                        message.destroy("deleteUser");
                        const { type,userId,accounts } = JSON.parse(e.message);
                        setFailedModalVisible(true);
                        setFailedDeletedMessage({ type,userId,accounts });
                        reload();
                      }).httpError(500, (e) => {
                        message.destroy("deleteUser");
                        message.error({
                          content: e.message,
                          duration: 4,
                        });
                      }).httpError(501, (e) => {
                        message.destroy("deleteUser");
                        message.error({
                          content: e.message,
                          duration: 4,
                        });
                      })
                      .then(() => {
                        message.destroy("deleteUser");
                        message.success(t(p("deleteSuccess")));
                        reload();
                      })
                      .catch(() => {
                        message.destroy("deleteUser");
                        message.error(t(p("deleteFail")));

                        reload();
                      });
                  }}
                >
                  <Tooltip title={t(p("delete"))}>
                    <DeleteIcon />
                  </Tooltip>
                </DeleteEntityModalLink>
              ) : null}
            </Space>
          )}
        />
      </Table>
      <DeleteEntityFailedModal
        message={failedDeletedMessage}
        open={failedModalVisible}
        onClose={() => {
          setFailedModalVisible(false);
        }}
      >
      </DeleteEntityFailedModal>
      <TenantUserInfoDrawer
        open={previewItem !== undefined}
        item={previewItem}
        onClose={() => setPreviewItem(undefined)}
      />
    </div>
  );
};
