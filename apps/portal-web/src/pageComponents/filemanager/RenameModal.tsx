import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form } from "antd";
import { basename, dirname, join } from "path";
import { useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: string;
  path: string;
  isFile: boolean;
}

interface FormProps {
  newFileName: string;
}

const p = prefix("pageComp.fileManagerComp.renameModal.");
const pCommon = prefix("common.");

export const RenameModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, isFile }) => {
  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  useEffect(() => {
    if (open) {
      form.setFieldValue("newFileName", basename(path));
    }
  }, [form, open, path]);

  const handleRenameSuccess = () => {
    message.success(t(p("successMessage")));
    reload();
    onClose();
    form.resetFields();
  };

  const moveFileItem = async (toPath: string) => {
    await api.moveFileItem({ body: { cluster, fromPath: path, toPath } }).httpError(429, () => {
      message.error(t(pCommon("noSpaceError")));
    });
  };

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    const toPath = join(dirname(path), newFileName);

    if (newFileName === basename(path)) {
      handleRenameSuccess();
      return;
    }

    setLoading(true);
    try {
      const { result: exists } = await api.fileExist({ query: { cluster, path: toPath } });

      if (exists) {
        const { type } = await api.getFileType({ query: { cluster, path: toPath } });
        const errorMessage =
          type === "dir" || type === "DIR" ? t(p("existedDirErrorMessage")) : t(p("existedErrorMessage"));
        form.setFields([{ name: "newFileName", errors: [errorMessage] }]);
        return;
      }

      await moveFileItem(toPath);
      handleRenameSuccess();
    } catch {
      // API 请求错误由全局 failEvent 或 httpError 处理器统一提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onDoubleClick={(event) => event.stopPropagation()}>
      <StyledModal
        open={open}
        title={isFile ? t(p("title")) : t(p("dirTitle"))}
        okText={t("button.confirmButton")}
        cancelText={t("button.cancelButton")}
        onCancel={onClose}
        confirmLoading={loading}
        destroyOnClose
        onOk={form.submit}
        getContainer={false}
      >
        <Form form={form} onFinish={onSubmit}>
          <Form.Item
            label={isFile ? t(p("newFileName")) : t(p("newDirName"))}
            name="newFileName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </StyledModal>
    </div>
  );
};
