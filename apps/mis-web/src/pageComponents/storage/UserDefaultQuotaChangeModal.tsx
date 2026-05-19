import { QuestionCircleOutlined } from "@ant-design/icons";
import { formatBytesToGB, formatGBToBytes } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, InputNumber, Modal, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/utils/cluster";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: Cluster;
  path: string;
  defaultQuotaBytes: number;
  totalQuotaBytes: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.userDefaultQuotaChangeModal.");
const pCommon = prefix("common.");

export const UserDefaultQuotaChangeModal: React.FC<Props> = ({
  open,
  onClose,
  reload,
  cluster,
  path,
  defaultQuotaBytes,
  totalQuotaBytes,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  return (
    <Modal
      open={open}
      destroyOnClose={true}
      title={t(p("modifyDefaultQuota"))}
      okText={t(p("confirm"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { quotaGB } = await form.validateFields();

        setLoading(true);
        await api
          .setTenantUserDefaultQuota({
            body: {
              cluster: cluster.id,
              path,
              userQuotaBytes: formatGBToBytes(quotaGB),
            },
          })
          .then((res) => {
            if (res.failures === 0) {
              message.success(t(p("modifyUserDeulatQuotaSuccess")));
            } else {
              message.error(t(p("modifyPartialSuccess"), [res.failedUserIds.slice(0, 3).join(", "), res.failures]));
            }
            reload();
            onClose();
          })
          .finally(() => setLoading(false));
      }}
    >
      <Form
        form={form}
        initialValues={{ quotaGB: formatBytesToGB(defaultQuotaBytes) }}
        labelAlign="left"
        style={{ marginTop: "20px" }}
      >
        <Form.Item label={t(p("cluster"))} style={{ marginBottom: "10px" }}>
          <span>{getI18nConfigCurrentText(cluster.name, languageId)}</span>
        </Form.Item>
        <Form.Item
          label={
            <div>
              {t(p("modifyDefaultQuota"))}
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
