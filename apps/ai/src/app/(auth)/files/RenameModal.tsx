"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal } from "antd";
import { dirname, join } from "path";
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

export const RenameModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.renameModal.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const mutation = trpc.file.copyOrMove.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload();
      onClose();
      form.resetFields();
    },
    onError: (e) => {
      message.error(e.message || t(p("failed")));
    },
  });

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    mutation.mutate({
      op: "move",
      clusterId: cluster.id,
      fromPath: path, toPath: join(dirname(path), newFileName),
    });
  };

  return (
    <Modal
      open={open}
      title={t(p("rename"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("wannaRename"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("newFileName"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
