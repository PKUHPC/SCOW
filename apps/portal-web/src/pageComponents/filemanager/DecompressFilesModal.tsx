import { DownOutlined } from "@ant-design/icons";
import { App, Form, Input, Modal, Tree } from "antd";
import { join } from "path";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DeCompression } from "src/pageComponents/filemanager/FileManager";
import { FileInfo } from "src/pages/api/file/list";
import { getFilePathWithoutExtension } from "src/server/file";

import { generateFilesTree } from "./CompressFilesModal";

interface Props {
  open: boolean;
  cluster: string;
  sourcePath: string;
  files: FileInfo[];
  onClose: () => void;
  reload: () => void;
  setDecompression?: React.Dispatch<React.SetStateAction<DeCompression>>;
}

interface FormProps {
  decompressionPath: string;
}

const p = prefix("pageComp.fileManagerComp.decompressFilesModal.");

export const DecompressFilesModal: React.FC<Props> = ({
  open, onClose, reload, setDecompression, sourcePath, files, cluster }) => {

  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm<FormProps>();

  const t = useI18nTranslateToString();

  const handleDecompress = async (decompressionPath: string) => {

    setDecompression?.((decompression) => ({
      ...decompression, decompressionStarted: decompression.decompressionStarted.concat(decompressionPath),
    }));

    await Promise.allSettled(files.map(async (f: FileInfo) => {

      return api.decompressFile({
        body: {
          clusterId: cluster,
          filePath: join(sourcePath, f.name),
          decompressionPath,
        },
      // 只通过下方对 result.status === "rejected" 的处理结果报错
      }).httpError(400, (err) => { throw err; })
        .httpError(403, (err) => { throw err; })
        .httpError(409, (err) => { throw err; })
        .httpError(429, (err) => { throw err; })
        .httpError(500, (err) => { throw err; });

    })).then((decompressionResults) => {

      setLoading(false);

      const errors = decompressionResults.reduce((acc: { fileName: string; reason: any }[], result, index) => {
        if (result.status === "rejected") {
          acc.push({ fileName: files[index].name, reason: result.reason });
        }
        return acc;
      }, []);

      if (errors.length === 0) {
        message.success(t(p("decompressionSuccess")));
      }

      if (errors.length > 0) {
        const errorDetails = errors.map((error) => {
          return `Filename: ${error?.fileName} \n`
                  + `Reason: ${error?.reason?.error || error?.reason?.text || error?.reason?.details || error?.reason}`;
        }).join("; \n\n");

        if (errors.length === files.length) {
          modal.error({
            title: t(p("decompressionFailed")),
            content: <div style={{ whiteSpace: "pre-wrap" }}>{errorDetails}</div>,
          });
        } else {
          modal.error({
            title: t(p("someFilesFailed")),
            content: <div style={{ whiteSpace: "pre-wrap" }}>{errorDetails}</div>,
          });
        }
      }
      reload();
      setDecompression?.((decompression) => {
        // 如果所有开始的任务都已经完成则清空
        if (decompression.decompressionCompleted.length + 1 === decompression.decompressionStarted.length) {
          return { decompressionCompleted: [], decompressionStarted: []};
        }

        return { ...decompression,
          decompressionCompleted: decompression.decompressionCompleted.concat(decompressionPath) };
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
      title={t(p("decompression"))}
      okText={t(p("decompressionConfirm"))}
      cancelText={t(p("cancel"))}
      onCancel={onClose}
      destroyOnClose
      onOk={form.submit}
      confirmLoading={loading}
    >
      <Form form={form} onFinish={onSubmit}>
        <span>{t(p("decompressFilesList"))}</span>
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
          label={t(p("decompressTargetPath"))}
          name="decompressionPath"
          rules={[{ required: true }]}
          initialValue={ join(sourcePath, getFilePathWithoutExtension(files[0]?.name) || "") }
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
