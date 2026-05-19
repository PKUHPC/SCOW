import { validateDataConsistency } from "@scow/lib-web/build/utils/form";
import { Divider, Form, Input, Modal } from "antd";
import { useState } from "react";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslate } from "src/i18n";

interface Props {
  clusterId: string;
  clusterName: string;
  onClose: () => void;
  onComplete: (confirmedClusterId: string, comment: string) => Promise<void>;
  open: boolean;
}

interface FormProps {
  confirmedClusterId: string;
  confirmedClusterName: string;
  comment: string;
}
const p = prefix("page.admin.resourceManagement.clusterManagement.deactivateModal.");

const DeactivateClusterModal: React.FC<Props> = ({ clusterId, clusterName, onClose, onComplete, open }) => {
  const tArgs = useI18nTranslate();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const onOK = async () => {
    const { confirmedClusterId, comment } = await form.validateFields();
    setLoading(true);
    await onComplete(confirmedClusterId, comment)
      .then(() => {
        form.resetFields();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  const languageId = useI18n().currentLanguage.id;

  return (
    <Modal title={tArgs(p("title"))} open={open} onOk={onOK} confirmLoading={loading} onCancel={onClose}>
      <Divider type="vertical" />
      <p>
        {tArgs(p("content"), [
          <strong key="clusterId">{clusterId}</strong>,
          <strong key="clusterName">{clusterName}</strong>,
        ])}
      </p>
      <p> {tArgs(p("contentInputNotice"))} </p>
      <p style={{ color: "red" }}> {tArgs(p("contentAttention"))} </p>

      <Form form={form} layout="vertical" initialValues={undefined} preserve={false}>
        <Form.Item
          name="confirmedClusterId"
          label={tArgs(p("clusterIdForm"))}
          hasFeedback
          {...validateDataConsistency("confirmedClusterId", clusterId, languageId)}
        >
          {/* 需满足完全一致校验, 无需考虑trim */}
          <Input onPaste={(e) => e.preventDefault()} />
        </Form.Item>
        <Form.Item
          name="confirmedClusterName"
          label={tArgs(p("clusterNameForm"))}
          hasFeedback
          {...validateDataConsistency("confirmedClusterName", clusterName, languageId)}
        >
          {/* 需满足完全一致校验, 无需考虑trim */}
          <Input onPaste={(e) => e.preventDefault()} />
        </Form.Item>
        <Form.Item name="comment" label={tArgs(p("comment"))}>
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
export const DeactivateClusterModalLink = ModalLink(DeactivateClusterModal);
