import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form } from "antd";
import { dirname, join } from "path";
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

const p = prefix("pageComp.fileManagerComp.renameModal.");
const pFileManager = prefix("pageComp.fileManagerComp.fileManager.");
const pCommon = prefix("common.");

export const RenameModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const { message, modal } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  const handleRenameSuccess = () => {
    message.success(t(p("successMessage")));
    reload();
    onClose();
    form.resetFields();
  };

  const moveFileItem = async (toPath: string) => {
    await api
      .moveFileItem({ body: { cluster, fromPath: path, toPath } })
      .httpError(429, () => {
        message.error(t(pCommon("noSpaceError")));
      });
  };

  const confirmOverwrite = (fileName: string, toPath: string) =>
    new Promise<boolean>((resolve, reject) => {
      modal.confirm({
        title: t(pFileManager("moveCopy.existModalTitle")),
        content: t(pFileManager("moveCopy.existModalContent"), [fileName]),
        okText: t(pFileManager("moveCopy.existModalOk")),
        onOk: async () => {
          try {
            const fileType = await api.getFileType({ query: { cluster, path: toPath } });
            const deleteOperation = fileType.type === "dir" || fileType.type === "DIR" ? api.deleteDir : api.deleteFile;
            await deleteOperation({ query: { cluster, path: toPath } });
            resolve(true);
          } catch (e) {
            reject(e);
          }
        },
        onCancel: () => resolve(false),
      });
    });

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    const toPath = join(dirname(path), newFileName);
    setLoading(true);
    try {
      const { result: exists } = await api.fileExist({ query: { cluster, path: toPath } });

      if (exists) {
        const shouldOverwrite = await confirmOverwrite(newFileName, toPath);
        if (!shouldOverwrite) {
          return;
        }
      }

      await moveFileItem(toPath);
      handleRenameSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onDoubleClick={(event) => event.stopPropagation()}>
      <StyledModal
        open={open}
        title={t(p("title"))}
        okText={t("button.confirmButton")}
        cancelText={t("button.cancelButton")}
        onCancel={onClose}
        confirmLoading={loading}
        destroyOnClose
        onOk={form.submit}
        getContainer={false}
      >
        <Form form={form} onFinish={onSubmit}>
          <Form.Item label={t(p("renameLabel"))}>
            <strong>{path}</strong>
          </Form.Item>
          <Form.Item label={t(p("newFileName"))} name="newFileName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </StyledModal>
    </div>
  );
};
