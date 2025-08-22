import { ExclamationCircleOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { AppAuthorizationInfo } from "@scow/protos/build/server/app_authorization";
import { App, Button, Divider, Form, Input, Modal, Space, Table, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType,AuthorizeAction } from "src/models/app";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";

interface Props {
  targetType: AppAuthTargetType;
  targetName: string;
  clusterId: string;
  appsInfo: AppAuthorizationInfo[];
  onClose: () => void;
  reload: () => void;
  open: boolean;
}

interface FilterForm {
  appName: string | undefined;
}

const p = prefix("pageComp.commonComponent.appAuthorization.authorizeAppModal.");

const AuthorizeAppModal: React.FC<Props> = ({
  targetType,
  targetName,
  clusterId,
  appsInfo,
  onClose,
  reload,
  open,

}) => {

  const { message, modal } = App.useApp();
  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    appName: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const clusterName =
    getI18nConfigCurrentText(publicConfigClusters[clusterId]?.name, languageId) ?? clusterId;

  const authorizeApp = async (appId: string, action: AuthorizeAction) => {
    setLoading(true);

    await api.authorizeApp({
      body: {
        targetType,
        targetName,
        clusterId,
        appId,
        appName: getI18nConfigCurrentText(appsInfo.find((app) => app.appId === appId)?.appName, languageId) ?? "",
        action,
      },
    })
      .then((res) => {
        if (res.executed) {
          message.success(action === AuthorizeAction.AUTHORIZE ?
            t(p("messages.authorizeSuccess")) : t(p("messages.unauthorizeSuccess")));
          reload();
        } else {
          // 添加res.reason
          message.error(action === AuthorizeAction.AUTHORIZE ?
            `${t(p("messages.authorizeFailed"))} ${res.reason}` :
            `${t(p("messages.unauthorizeFailed"))} ${res.reason}`);
        }
      })
      .finally(() => setLoading(false));
  };


  // 前端过滤查询结果
  const filteredData = useMemo(() => {

    if (!appsInfo) return undefined;
    if (!query.appName) {
      return appsInfo;
    }
    const filteredValues = appsInfo
      .filter((app) => app.appName.toLowerCase().includes(query.appName?.toLowerCase() || ""));
    return filteredValues;

  }, [appsInfo, query]);

  useEffect(() => {
    if (open) {
      filterForm.resetFields();
      setQuery(initialFilterQuery);
    }
  }, [open, filterForm]);

  return (
    <Modal
      title={t(p("title"))}
      open={open}
      confirmLoading={loading}
      onCancel={onClose}
      footer={null}
    >
      <div>
        <span>
          {targetType === AppAuthTargetType.TENANT ? t(p("tenant")) : t(p("account"))}：
          <span>{targetName}</span>
        </span>
        <Divider type="vertical" />
        <span>
          {t(p("cluster"))}：
          <span>{clusterName}</span>
        </span>
      </div>

      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={initialFilterQuery}
          onFinish={async () => {
            const { appName } = await filterForm.validateFields();
            setQuery({ appName: appName === "" ? undefined : appName?.trim() });
          }}
        >
          <Form.Item name="appName">
            <Input allowClear placeholder={t(p("searchPlaceholder"))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t(p("searchButton"))}
            </Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={loading}
        pagination={false}
        rowKey="id"
        scroll={{ y: 500 }}
      >
        <Table.Column<AppAuthorizationInfo>
          dataIndex="appName"
          title={t(p("appName"))}
          width="70%"
          render={(_, r) => {
            return (
              <>
                <Space
                  style={{ width: "150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {r.appName}
                </Space>
                <Divider type="vertical" />
                <Tag color={r.isDisabled ? "red" : "green"}>
                  {r.isDisabled ? t(p("status.unauthorized")) : t(p("status.authorized"))}
                </Tag>
              </>
            );
          }}
        />
        <Table.Column<AppAuthorizationInfo>
          dataIndex=""
          title={t(p("operation"))}
          width="30%"
          align="center"
          fixed="right"
          render={(_, r) => (
            <Space>
              {
                r.isDisabled ? (
                  // 授权应用
                  <a onClick={() => {
                    const contentTexts = (targetType === AppAuthTargetType.TENANT)
                      ? t(p("confirm.authorize.tenantContent"), [clusterName, r.appName, targetName])
                      : t(p("confirm.authorize.accountContent"), [clusterName, r.appName, targetName]);
                    modal.confirm({
                      title: t(p("confirm.authorize.title")),
                      icon: <ExclamationCircleOutlined />,
                      content: (
                        <>
                          <p>
                            {contentTexts}
                          </p>
                        </>
                      ),
                      onOk: async () => {
                        await authorizeApp(r.appId, AuthorizeAction.AUTHORIZE);
                      },
                    });
                  }}
                  >
                    {t(p("actions.authorize"))}
                  </a>
                ) : (
                  // 取消授权应用
                  <a onClick={() => {
                    const contentTexts = (targetType === AppAuthTargetType.TENANT)
                      ? t(p("confirm.unauthorize.tenantContent"), [clusterName, r.appName, targetName])
                      : t(p("confirm.unauthorize.accountContent"), [clusterName, r.appName, targetName]);
                    modal.confirm({
                      title: t(p("confirm.unauthorize.title")),
                      icon: <ExclamationCircleOutlined />,
                      content: (
                        <>
                          <p>
                            {contentTexts}
                          </p>
                          {
                            targetType === AppAuthTargetType.TENANT ?
                              (
                                <p style={{ color: "red" }}>
                                  {t(p("confirm.unauthorize.tenantWarning"))}
                                </p>
                              ) : undefined
                          }
                        </>
                      ),
                      onOk: async () => {
                        await authorizeApp(r.appId, AuthorizeAction.UNAUTHORIZE);
                      },
                    });
                  }}
                  >
                    {t(p("actions.unauthorize"))}
                  </a>
                )
              }
            </Space>
          )}
        />
      </Table>
    </Modal>
  );
};

export const AuthorizeAppModalLink = ModalLink(AuthorizeAppModal);
