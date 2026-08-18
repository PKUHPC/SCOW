import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal } from "antd";
import { join } from "path";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: string;
  path: string;
}

interface FormProps {
  newFileName: string;
}

const p = prefix("pageComp.fileManagerComp.createFileModal.");
const pCommon = prefix("common.");

export const CreateFileModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    const targetPath = join(path, newFileName);
    setLoading(true);
    await api
      .createFile({ body: { cluster, path: targetPath } })
      .httpError(409, async () => {
        const { type } = await api.getFileType({ query: { cluster, path: targetPath } });
        const errorMessage = type === "dir" || type === "DIR" ? "existedDirErrorMessage" : "existedFileErrorMessage";
        form.setFields([{ name: "newFileName", errors: [t(p(errorMessage))] }]);
      })
      .httpError(429, () => {
        message.error(t(pCommon("noSpaceError")));
      })
      .then(() => {
        message.success(t(p("createSuccessMessage")));
        reload();
        onClose();
        form.resetFields();
      })
      .catch(() => {
        // API 请求错误由全局 failEvent 或上面的 httpError 处理器统一提示
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      open={open}
      title={t(p("create"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("fileName"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
