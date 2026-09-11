import { QuestionCircleOutlined } from "@ant-design/icons";
import { formatGBToMB, formatMBToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { App, Form, InputNumber, Modal, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { NUMERIC_GROUP_NAME_RESOLUTION_FAILED } from "src/utils/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  storageLabel: string;
  storageId: string;
  defaultQuotaMb: number;
  totalStorageMb: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.accountDefaultQuotaChangeModal.");
const pCommon = prefix("common.");

export const AccountDefaultQuotaChangeModal: React.FC<Props> = ({
  open, onClose, reload, storageLabel, storageId, defaultQuotaMb, totalStorageMb,
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
        await api.setAccountDefaultQuota({ body: {
          storageId, quotaMb: Math.round(formatGBToMB(quotaGB)),
        } })
          .httpError(400, () => {
            message.error(t(p("quotaExceedsLimit")));
          })
          .httpError(500, (error) => {
            if (error.code === NUMERIC_GROUP_NAME_RESOLUTION_FAILED) {
              message.error(`${t("common.groupNameResolutionFailed")}${error.details ? ` ${error.details}` : ""}`);
            }
          })
          .then((res) => {
            if (res.failures === 0) {
              message.success(t(p("modifySuccess")));
            } else {
              message.warning(
                t(p("modifyPartialSuccess"), [res.failedAccountNames.slice(0, 3).join(", "), res.failures]),
              );
            }
            reload();
            onClose();
          })
          .finally(() => setLoading(false));
      }}
    >
      <Form
        form={form}
        initialValues={{ quotaGB: parseFloat(formatMBToGB(defaultQuotaMb).toFixed(2)) }}
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
          rules={[{ required: true }, { type: "number", min: 0.01, message: t(p("quotaMustBePositive")) }]}
        >
          <InputNumber min={0.01} max={totalStorageMb / 1024} precision={2} addonAfter={"GB"} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
