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
  const pFileManager = prefix("app.files.fileManager.");

  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const renameMutation = trpc.file.copyOrMove.useMutation();
  const checkFileExistMutation = trpc.file.checkFileExist.useMutation();
  const getFileTypeMutation = trpc.file.getFileType.useMutation();
  const deleteMutation = trpc.file.deleteItem.useMutation();

  const handleRenameSuccess = () => {
    message.success(t(p("success")));
    reload();
    onClose();
    form.resetFields();
  };

  const handleRenameError = (e: any) => {
    if (e.data?.code === "CONFLICT") {
      message.error(t(p("failed")));
      return;
    }

    message.error(e.message || t(p("failed")));
  };

  const confirmOverwrite = (fileName: string, toPath: string) =>
    new Promise<boolean>((resolve, reject) => {
      modal.confirm({
        title: t(pFileManager("existModalTitle")),
        content: t(pFileManager("existModalContent"), [fileName]),
        okText: t(pFileManager("existModalOk")),
        onOk: async () => {
          try {
            const fileType = await getFileTypeMutation.mutateAsync({
              clusterId: cluster.id,
              path: toPath,
            });
            await deleteMutation.mutateAsync({
              clusterId: cluster.id,
              target: fileType.type === "DIR" ? "DIR" : "FILE",
              path: toPath,
            });
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

    try {
      const { exists } = await checkFileExistMutation.mutateAsync({
        clusterId: cluster.id,
        path: toPath,
      });

      if (exists) {
        const shouldOverwrite = await confirmOverwrite(newFileName, toPath);
        if (!shouldOverwrite) {
          return;
        }
      }

      await renameMutation.mutateAsync({
        op: "move",
        clusterId: cluster.id,
        fromPath: path,
        toPath,
      });
      handleRenameSuccess();
    } catch (e) {
      handleRenameError(e);
    }
  };

  return (
    <Modal
      open={open}
      title={t(p("rename"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={
        renameMutation.isPending ||
        checkFileExistMutation.isPending ||
        getFileTypeMutation.isPending ||
        deleteMutation.isPending
      }
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
