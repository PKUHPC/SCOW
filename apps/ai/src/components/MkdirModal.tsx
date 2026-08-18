"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal } from "antd";
import { join } from "path";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";

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

export const MkdirModal: React.FC<Props> = ({ open, onClose, path, reload, clusterId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.mkdirModal.");
  const pCommon = prefix("common.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();
  const getFileType = trpc.file.getFileType.useMutation();

  const mutation = trpc.file.mkdir.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload(form.getFieldValue("newDirName"));
      onClose();
      form.resetFields();
    },
    onError: async (e, variables) => {
      if (e.data?.code === "CONFLICT") {
        try {
          const { type } = await getFileType.mutateAsync({ clusterId, path: variables.path });
          const errorMessage = type === "DIR" ? "existedDirErrorMessage" : "existedFileErrorMessage";
          form.setFields([{ name: "newDirName", errors: [t(p(errorMessage))] }]);
        } catch {
          // getFileType 的请求错误由全局 MutationCache 统一提示
          return;
        }
      } else if (e.data?.code === "TOO_MANY_REQUESTS") {
        message.error(t(pCommon("noSpaceError")));
      } else {
        message.error(`${t(p("failed"))}: ${e.message}`);
      }
    },
  });

  const onSubmit = async () => {
    const { newDirName } = await form.validateFields();

    mutation.mutate({
      path: join(path, newDirName),
      clusterId,
    });
  };

  return (
    <Modal
      open={open}
      title={t(p("mkDir"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("newDirName"))} name="newDirName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
