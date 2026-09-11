import { QuestionCircleOutlined } from "@ant-design/icons";
import { formatGBToMB, formatMBToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { App, Form, InputNumber, Modal, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  storageLabel: string;
  storageId: string;
  defaultQuotaMb: number;
  totalQuotaMb: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.userDefaultQuotaChangeModal.");
const pCommon = prefix("common.");

export const UserDefaultQuotaChangeModal: React.FC<Props> = ({
  open, onClose, reload, storageLabel, storageId, defaultQuotaMb, totalQuotaMb,
}) => {
  const t = useI18nTranslateToString();

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
        await api.setTenantUserDefaultQuota({ body: {
          storageId, userQuotaMb: formatGBToMB(quotaGB),
        } })
          .then((res) => {
            if (res.failures === 0) {
              message.success(t(p("modifyUserDefaultQuotaSuccess")));
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
        initialValues={{ quotaGB: formatMBToGB(defaultQuotaMb) }}
        labelAlign="left"
        style={{ marginTop: "20px" }}
      >
        <Form.Item label={t(p("fileSystem"))} style={{ marginBottom: "10px" }}>
          <span>{storageLabel}</span>
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
          <InputNumber
            min={0.01}
            max={formatMBToGB(totalQuotaMb)}
            precision={2}
            addonAfter={"GB"}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
