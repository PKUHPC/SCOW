import { ExclamationCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { formatBytesToGB, formatGBToBytes } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, InputNumber, Modal, Space, Tooltip } from "antd";
import modal from "antd/es/modal";
import { useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { UserQuotaInfo } from "src/pages/api/storage/getTenantQuota";
import { Cluster } from "src/utils/cluster";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  // 单个用户模式的属性
  username?: string;
  userId?: string;
  quotaBytes?: number;
  usedStorageBytes?: number;
  useDefault?: boolean;
  // 批量模式的属性
  selectedUsers?: UserQuotaInfo[];
  isBatch?: boolean;
  // 共同属性
  cluster: Cluster;
  path: string;
  defaultQuotaBytes: number;
  totalQuotaBytes: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.userQuotaChangeModal.");
const pCommon = prefix("common.");

export const UserQuotaChangeModal: React.FC<Props> = ({
  open,
  onClose,
  reload,
  cluster,
  username,
  userId,
  path,
  quotaBytes,
  usedStorageBytes,
  useDefault,
  totalQuotaBytes,
  defaultQuotaBytes,
  selectedUsers,
  isBatch,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  useEffect(() => {
    if (!isBatch && quotaBytes !== undefined) {
      form.setFieldValue("quotaBytes", quotaBytes);
    }
  }, [quotaBytes, isBatch]);

  return (
    <Modal
      open={open}
      title={isBatch ? t(p("batchModifyStorageQuota")) : t(p("modifyStorageQuota"))}
      okText={t(p("confirm"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { quotaGB } = await form.validateFields();

        setLoading(true);

        if (isBatch && selectedUsers) {
          // 批量修改
          const userIds = selectedUsers.map((user) => user.userId);
          await api
            .batchSetTenantUsersQuota({
              body: {
                cluster: cluster.id,
                path,
                userIds,
                userQuotaBytes: formatGBToBytes(quotaGB),
              },
            })
            .then(({ failedUserIds }) => {
              const failedUserNum = failedUserIds.length;
              if (failedUserNum > 0) {
                message.warning(
                  t(p("batchModifyUserQuotaPartialSuccess"), [userIds.length - failedUserNum, failedUserNum]),
                );
              } else {
                message.success(t(p("batchModifyUserQuotaSuccess")));
              }

              reload();
              onClose();
            })
            .catch(() => {
              message.error(t(p("batchModifyUserQuotaFailed")));
            })
            .finally(() => setLoading(false));
        } else if (userId !== undefined) {
          // 单个用户修改
          await api
            .setTenantUserQuota({
              body: {
                userId,
                cluster: cluster.id,
                path,
                userQuotaBytes: formatGBToBytes(quotaGB),
              },
            })
            .httpError(404, () => {
              message.error(t(p("userNotFound"), [userId]));
              return;
            })
            .then(() => {
              message.success(t(p("modifyUserQuotaSuccess")));
              reload();
              onClose();
            })
            .catch(() => {
              message.error(t(p("modifyUserQuotaFailed")));
            })
            .finally(() => setLoading(false));
        }
      }}
    >
      <Form
        form={form}
        initialValues={{ quotaGB: isBatch ? 0 : quotaBytes ? formatBytesToGB(quotaBytes) : 0 }}
        labelAlign="left"
        style={{ marginTop: "20px" }}
      >
        {isBatch ? (
          <Form.Item label={t(p("selectedUsers"))} style={{ marginBottom: "10px" }}>
            <span>{selectedUsers?.map((user) => user.userId).join(", ")}</span>
          </Form.Item>
        ) : (
          <Form.Item label={t(p("user"))} style={{ marginBottom: "10px" }}>
            <span>{`${username}(ID: ${userId})`}</span>
          </Form.Item>
        )}
        <Form.Item label={t(p("cluster"))} style={{ marginBottom: "10px" }}>
          <span>{getI18nConfigCurrentText(cluster.name, languageId)}</span>
        </Form.Item>
        <Form.Item label={`${t(p("defaultStorageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
          <Space>
            <span>{formatBytesToGB(defaultQuotaBytes).toFixed(2)}</span>
            {/* 批量模式下的使用默认值链接 */}
            {isBatch && (
              <a
                onClick={() => {
                  modal.confirm({
                    title: t(p("batchUseDefaultStorageQuota")),
                    cancelText: t(pCommon("cancel")),
                    okText: t(pCommon("ok")),
                    icon: <ExclamationCircleOutlined />,
                    content: (
                      <Space direction="vertical">
                        <span>
                          {`${t(p("currentDefaultStorageQuota"))}（GB）：`}
                          <span>{formatBytesToGB(defaultQuotaBytes).toFixed(2)}</span>
                        </span>
                        <span>{t(p("confirmBatchUseDefaultStorageQuota"))}</span>
                      </Space>
                    ),
                    onOk: async () => {
                      const userIds = selectedUsers?.map((user) => user.userId) || [];
                      await api
                        .batchSetTenantUsersQuota({
                          body: {
                            cluster: cluster.id,
                            path,
                            userIds,
                            userQuotaBytes: defaultQuotaBytes,
                            useTenantDefaultUserQuota: true,
                          },
                        })
                        .then(({ failedUserIds }) => {
                          const failedUserNum = failedUserIds.length;
                          if (failedUserNum > 0) {
                            message.warning(
                              t(p("batchModifyUserQuotaPartialSuccess"), [
                                userIds.length - failedUserNum,
                                failedUserNum,
                              ]),
                            );
                          } else {
                            message.success(t(p("batchModifyUserQuotaSuccess")));
                          }

                          reload();
                          onClose();
                        })
                        .catch(() => {
                          message.error(t(p("batchModifyUserQuotaFailed")));
                        })
                        .finally(() => setLoading(false));
                    },
                  });
                }}
              >
                {t(p("useDefaultValue"))}
              </a>
            )}
          </Space>
        </Form.Item>
        {!isBatch && userId && (
          <Form.Item label={`${t(p("currentUsage"))}/${t(p("storageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
            <Space>
              <span>
                {`${formatBytesToGB(usedStorageBytes || 0).toFixed(2)} / ${formatBytesToGB(quotaBytes || 0).toFixed(
                  2,
                )}`}
              </span>
              {!useDefault && (
                <a
                  onClick={() => {
                    modal.confirm({
                      title: t(p("useDefaultStroageQuota")),
                      cancelText: t(pCommon("cancel")),
                      okText: t(pCommon("ok")),
                      icon: <ExclamationCircleOutlined />,
                      content: (
                        <Space direction="vertical">
                          <span>
                            {`${t(p("currentDefaultStorageQuota"))}（GB）：`}
                            <span>{formatBytesToGB(defaultQuotaBytes).toFixed(2)}</span>
                          </span>
                          <span>{t(p("confirmUseDefaultStorageQuota"))}</span>
                        </Space>
                      ),
                      onOk: async () => {
                        await api
                          .setTenantUserQuota({
                            body: {
                              userId,
                              cluster: cluster.id,
                              path,
                              userQuotaBytes: defaultQuotaBytes,
                              useTenantDefaultUserQuota: true,
                            },
                          })
                          .httpError(304, () => message.warning(t(p("alreadyUsedDefault"))))
                          .then(() => {
                            message.success(t(p("modifyUserQuotaSuccess")));
                            reload();
                            onClose();
                          })
                          .finally(() => setLoading(false));
                      },
                    });
                  }}
                >
                  {t(p("useDefaultValue"))}
                </a>
              )}
            </Space>
          </Form.Item>
        )}
        <Form.Item
          label={
            <div>
              {t(p("setStorageQuota"))}
              <Tooltip title={t(p("tip"))}>
                <QuestionCircleOutlined style={{ marginLeft: 5 }} />
              </Tooltip>
            </div>
          }
          name="quotaGB"
          rules={[{ required: true }]}
        >
          <InputNumber min={0.01} max={formatBytesToGB(totalQuotaBytes)} precision={2} addonAfter={"GB"} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
