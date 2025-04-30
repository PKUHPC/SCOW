import { App, Form, Modal } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: (() => void) | ((dirName: string) => Promise<void>);
  clusterId: string;
  path: string;
}

interface FormProps {
  newDirName: string;
}

export const DecompressFileInCurrentFolderModal: React.FC<Props> = ({ open, onClose, path, reload, clusterId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.app.decompressionModal.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const pathParts = path.split("/");
    pathParts.pop();
    const decompressionPath = pathParts.join("/");
    setLoading(true);
    await api.decompressFile({ body: { clusterId, filePath: path, decompressionPath } })
      .httpError(400, () => { message.error(t(p("typeError"))); })
      .httpError(403, () => { message.error(t(p("permissionDenied"))); })
      .httpError(409, () => { message.error(t(p("unimplementedError"))); })
      .httpError(500, (err) => {
        message.error(`${t(p("failure"))} Details: ${err.error}`);
      })
      .then(() => {
        message.success(t(p("success")));
        reload(form.getFieldValue("newDirName"));
        onClose();
        form.resetFields();
      })
      .finally(() => setLoading(false));
  };


  return (
    <Modal
      open={open}
      title={t(p("decompression"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={onSubmit}
    >
      {t(p("confirmText"))}{path}
    </Modal>
  );
};
