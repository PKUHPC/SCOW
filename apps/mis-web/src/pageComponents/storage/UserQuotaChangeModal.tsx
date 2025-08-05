import { ExclamationCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { formatBytesToGB, formatGBToBytes } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, InputNumber, Modal, Space, Tooltip } from "antd";
import modal from "antd/es/modal";
import { useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/utils/cluster";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  username: string;
  userId: string;
  cluster: Cluster;
  path: string;
  quotaBytes: number;
  usedStorageBytes: number;
  useDefault: boolean;
  defaultQuotaBytes: number;
  totalQuotaBytes: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.userQuotaChangeModal.");
const pCommon = prefix("common.");


export const UserQuotaChangeModal: React.FC<Props> = ({
  open, onClose, reload, cluster, username, userId,
  path, quotaBytes, usedStorageBytes, useDefault, totalQuotaBytes, defaultQuotaBytes,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  useEffect(() => {
    form.setFieldValue("quotaBytes", quotaBytes);
  }, [quotaBytes]);

  return (
    <Modal
      open={open}
      title={t(p("modifyStorageQuota"))}
      okText={t(p("confirm"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { quotaGB } = await form.validateFields();

        setLoading(true);
        await api.setTenantUserQuota({ body: {
          userId, cluster: cluster.id, path, userQuotaBytes: formatGBToBytes(quotaGB),
        } })
          .then(() => {
            message.success(t(p("modifyUserQuotaSuccess")));
            reload();
            onClose();
          })
          .catch(() => {
            message.error(t(p("modifyUserQuotaFailed")));
          })
          .finally(() => setLoading(false));

      }}
    >
      <Form
        form={form}
        initialValues={{ quotaGB: formatBytesToGB(quotaBytes) }}
        labelAlign="left"
        style={{ marginTop: "20px" }}
      >
        <Form.Item label={t(p("user"))} style={{ marginBottom: "10px" }}>
          <span>{`${username}(ID: ${userId})`}</span>
        </Form.Item>
        <Form.Item label={t(p("cluster"))} style={{ marginBottom: "10px" }}>
          <span>{getI18nConfigCurrentText(cluster.name, languageId)}</span>
        </Form.Item>
        <Form.Item label={`${t(p("defaultStorageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
          <span>{formatBytesToGB(defaultQuotaBytes).toFixed(2)}</span>
        </Form.Item>
        <Form.Item label={`${t(p("currentUsage"))}/${t(p("storageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
          <Space>
            <span>
              {`${formatBytesToGB(usedStorageBytes).toFixed(2)} / ${formatBytesToGB(quotaBytes).toFixed(2)}`}
            </span>
            { !useDefault && (
              <a onClick={() => {
                modal.confirm({
                  title: t(p("useDefaultStroageQuota")),
                  cancelText: t(pCommon("cancel")),
                  okText: t(pCommon("ok")),
                  icon: <ExclamationCircleOutlined />,
                  content: <Space direction="vertical">
                    <span>{`${t(p("currentDefaultStorageQuota"))}（GB）：`}
                      <span>
                        {formatBytesToGB(defaultQuotaBytes).toFixed(2)}
                      </span>
                    </span>
                    <span>{t(p("confirmUseDefaultStorageQuota"))}</span>
                  </Space>,
                  onOk: async () => {
                    await api.setTenantUserQuota({ body: {
                      userId, cluster: cluster.id, path, useTenantDefaultUserQuota: true,
                    } })
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
        <Form.Item
          label={(
            <div>
              {t(p("setStorageQuota"))}
              <Tooltip title={t(p("tip"))}>
                <QuestionCircleOutlined style={{ marginLeft: 5 }} />
              </Tooltip>
            </div>
          )}
          name="quotaGB"
          rules={[{ required: true }]}
        >
          <InputNumber
            min={0.01}
            max={formatBytesToGB(totalQuotaBytes)}
            precision={2}
            addonAfter={"GB"}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
