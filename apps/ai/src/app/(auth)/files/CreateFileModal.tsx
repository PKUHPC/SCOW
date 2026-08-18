"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal } from "antd";
import { join } from "path";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: Cluster;
  path: string;
}

interface FormProps {
  newFileName: string;
}

export const CreateFileModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.createFileModal.");

  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const getFileType = trpc.file.getFileType.useMutation();

  const mutation = trpc.file.createFile.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload();
      onClose();
      form.resetFields();
    },
    onError: async (e, variables) => {
      if (e.data?.code === "CONFLICT") {
        try {
          const { type } = await getFileType.mutateAsync({ clusterId: cluster.id, path: variables.path });
          const errorMessage = type === "DIR" ? "existedDirErrorMessage" : "existedFileErrorMessage";
          form.setFields([{ name: "newFileName", errors: [t(p(errorMessage))] }]);
        } catch {
          // getFileType 的请求错误由全局 MutationCache 统一提示
          return;
        }
      } else {
        throw e;
      }
    },
  });

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();

    mutation.mutate({ path: join(path, newFileName), clusterId: cluster.id });
  };

  return (
    <Modal
      open={open}
      title={t(p("createFile"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("name"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
