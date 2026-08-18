"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal } from "antd";
import { basename, dirname, join } from "path";
import { useEffect } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: Cluster;
  path: string;
  isFile: boolean;
}

interface FormProps {
  newFileName: string;
}

export const RenameModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, isFile }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.renameModal.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const renameMutation = trpc.file.copyOrMove.useMutation();
  const checkFileExistMutation = trpc.file.checkFileExist.useMutation();
  const getFileTypeMutation = trpc.file.getFileType.useMutation();

  useEffect(() => {
    if (open) {
      form.setFieldValue("newFileName", basename(path));
    }
  }, [form, open, path]);

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

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    const toPath = join(dirname(path), newFileName);

    if (newFileName === basename(path)) {
      handleRenameSuccess();
      return;
    }

    try {
      const { exists } = await checkFileExistMutation.mutateAsync({
        clusterId: cluster.id,
        path: toPath,
      });

      if (exists) {
        const { type } = await getFileTypeMutation.mutateAsync({
          clusterId: cluster.id,
          path: toPath,
        });
        const errorMessage = type === "DIR" ? t(p("existedDirErrorMessage")) : t(p("existedErrorMessage"));
        form.setFields([{ name: "newFileName", errors: [errorMessage] }]);
        return;
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
      title={isFile ? t(p("rename")) : t(p("dirTitle"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={renameMutation.isPending || checkFileExistMutation.isPending || getFileTypeMutation.isPending}
      destroyOnClose
      onOk={form.submit}
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
    </Modal>
  );
};
