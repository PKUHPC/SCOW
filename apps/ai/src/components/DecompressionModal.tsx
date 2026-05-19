"use client";

import { DownOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Modal, Tree } from "antd";
import { join } from "path";
import { useState } from "react";
import { Compression } from "src/app/(auth)/files/FileManager";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo } from "src/models/File";
import { generateFilesTree, getFilePathWithoutExtension } from "src/utils/file";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  clusterId: string;
  sourcePath: string;
  usePublicPath?: boolean;
  files: FileInfo[];
  onClose: () => void;
  reload: () => void;
  setDecompression?: React.Dispatch<React.SetStateAction<Compression>>;
}

interface FormProps {
  decompressionPath: string;
}

export const DecompressionModal: React.FC<Props> = ({
  open,
  onClose,
  reload,
  clusterId,
  sourcePath,
  usePublicPath,
  files,
  setDecompression,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.decompressionModal.");
  const pCommon = prefix("common.");

  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const [loading, setLoading] = useState(false);

  const mutation = trpc.file.decompressFile.useMutation({
    // 不显示错误信息trpcClient.tsx中的兜底信息
    onError: (e) => {
      if (e.data?.code === "TOO_MANY_REQUESTS") {
        message.error(t(pCommon("noSpaceError")));
      }
    },
  });

  const handleDecompress = async (decompressionPath: string) => {
    setDecompression?.((decompression) => ({
      ...decompression,
      started: decompression.started.concat(decompressionPath),
    }));

    await Promise.allSettled(
      files.map(async (f: FileInfo) => {
        return mutation.mutateAsync({
          clusterId,
          filePath: join(sourcePath, f.name),
          decompressionPath,
          usePublicPath,
        });
      }),
    ).then((decompressionResults) => {
      setLoading(false);

      const errors = decompressionResults.reduce((acc: { fileName: string; reason: any }[], result, index) => {
        if (result.status === "rejected") {
          acc.push({ fileName: files[index].name, reason: result.reason });
        }
        return acc;
      }, []);

      if (errors.length === 0) {
        message.success(t(p("success")));
      }

      if (errors.length > 0) {
        const errorDetails = errors
          .map((error) => {
            const rawReason = error?.reason?.error || error?.reason?.text || error?.reason?.details || error?.reason;

            const finalReason = String(rawReason).includes("is outside user home directory")
              ? "Operation exceeds path boundary limits"
              : rawReason;

            return `Filename: ${error?.fileName} \nReason: ${finalReason}`;
          })
          .join("; \n\n");

        if (errors.length === files.length) {
          modal.error({
            title: t(p("failed")),
            content: <div style={{ whiteSpace: "pre-wrap" }}>{errorDetails}</div>,
          });
        } else {
          modal.error({
            title: t(p("someFailed")),
            content: <div style={{ whiteSpace: "pre-wrap" }}>{errorDetails}</div>,
          });
        }
      }
      reload();
      setDecompression?.((decompression) => {
        // 如果所有开始的任务都已经完成则清空
        if (decompression.completed.length + 1 === decompression.started.length) {
          return { completed: [], started: [] };
        }

        return { ...decompression, completed: decompression.completed.concat(decompressionPath) };
      });
    });
  };

  const onSubmit = async () => {
    const { decompressionPath } = await form.validateFields();
    setLoading(true);
    handleDecompress(decompressionPath);
    onClose();
    form.resetFields();
  };

  return (
    <Modal
      open={open}
      title={t(p("decompress"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <strong>{t(p("toDecompressList"))}</strong>
        <Tree
          showLine
          style={{ marginTop: "8px" }}
          height={300}
          switcherIcon={<DownOutlined />}
          defaultExpandedKeys={["root"]}
          selectable={false}
          treeData={generateFilesTree(sourcePath, files)}
        />
        <Form.Item
          label={t(p("decompressionPath"))}
          name="decompressionPath"
          rules={[{ required: true }]}
          initialValue={join(sourcePath, getFilePathWithoutExtension(files[0]?.name) || "")}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
