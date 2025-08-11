"use client";

import { DownOutlined } from "@ant-design/icons";
import { App, Form, Input, Modal, Tree } from "antd";
import { join } from "path";
import { useState } from "react";
import { Compression } from "src/app/(auth)/files/FileManager";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo } from "src/models/File";
import { generateFilesTree } from "src/utils/file";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  clusterId: string;
  path: string;
  files: FileInfo[];
  onClose: () => void;
  reload: () => void;
  setCompression?: React.Dispatch<React.SetStateAction<Compression>>;
}

interface FormProps {
  zipFileName: string;
}

const fileSuffix = ".zip";

export const CompressionModal: React.FC<Props> = ({ open, onClose, reload, clusterId, path,
  files, setCompression }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.compressionModal.");
  const pCommon = prefix("common.");


  const { message,modal } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const [loading, setLoading] = useState(false);

  const compressFilesMutation = trpc.file.compressFiles.useMutation({
    onSuccess: async () => {
      const { zipFileName } = await form.validateFields();
      setCompression?.((compression) => {
        // 如果所有开始的任务都已经完成则清空
        if (compression.completed.length + 1 === compression.started.length) {
          return { completed: [], started: []};
        }

        return { ...compression, completed: compression.completed.concat(zipFileName) };
      });
      onClose();
      reload();
      form.resetFields();
      message.success(t(p("success")));
    },
    onError: (e) => {
      if (e.data?.code === "TOO_MANY_REQUESTS") {
        message.error(t(pCommon("noSpaceError")));
      }
      setCompression?.((compression) => {
        // 如果所有开始的任务都已经完成则清空
        if (compression.completed.length + 1 === compression.started.length) {
          return { completed: [], started: []};
        }

        return { ...compression, completed: compression.completed.concat("") };
      });
      message.error(`${t(p("failed"))}: ${e.message}`);
    },
  });
  const checkFileExistMutation = trpc.file.checkFileExist.useMutation();

  const handleCompress = (zipFileName: string) => {

    setCompression?.((compression) => ({
      ...compression, started: compression.started.concat(zipFileName + fileSuffix),
    }));

    compressFilesMutation.mutate({
      clusterId,
      filePaths:files.map((f) => join(path, f.name)),
      archivePath:join(path, zipFileName + fileSuffix),
    });

  };

  const onSubmit = async () => {
    const { zipFileName } = await form.validateFields();
    setLoading(true);
    const checkExistRes = await checkFileExistMutation.mutateAsync({
      clusterId,
      path:join(path, zipFileName + fileSuffix),
    });

    if (checkExistRes.exists) {
      await new Promise<void>((res) => {
        modal.confirm({
          title: t(p("alreadyExisted")),
          content: t(p("overwrite"),[zipFileName]),
          okText: t(p("confirm")),
          onOk: async () => {
            handleCompress(zipFileName);
          },
          onCancel: async () => { res(); },
        });
      });
    } else {
      handleCompress(zipFileName);
    }
    setLoading(false);
  };

  return (
    <Modal
      open={open}
      title={t(p("compress"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <strong>{t(p("toCompressList"))}</strong>
        <Tree
          showLine
          style={{ marginTop: "8px" }}
          height={300}
          switcherIcon={<DownOutlined />}
          defaultExpandedKeys={["root"]}
          selectable={false}
          treeData={generateFilesTree(path, files)}
        />
        <Form.Item
          label={t(p("zipFileName"))}
          name="zipFileName"
          rules={[{ required: true }]}
          initialValue={files[0]?.name || ""}
        >
          <Input addonAfter={fileSuffix} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
