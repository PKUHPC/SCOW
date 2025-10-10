import { App, Form, Input, Modal } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ImageType } from "src/models/Image";
import { imageNameValidation, imageTagValidation } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  jobId: number;
  clusterId: string;
  imageName: string;
  imageTag: string;
}

interface FormFields {
  name: string,
  tag: string,
  types?: ImageType[],
  inferServicePort?: number,
  startCommand?: string,
  description?: string,
}

export const SaveDevHostModal: React.FC<Props> = ({
  open,
  onClose,
  reload,
  jobId,
  clusterId,
  imageName,
  imageTag,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.listPage.saveImageModal.");

  const [form] = Form.useForm<FormFields>();

  const { message } = App.useApp();

  const saveImageMutation = trpc.jobs.saveImage.useMutation({
    onSuccess() {
      message.success(t(p("saveSuccessfully")));
      onClose();
      form.resetFields();
      reload();
    },
    onError(e) {
      message.error(`${t(p("saveFailed"))}:${e.message}`);
    },
  });

  const handleFinish = async () => {
    const { name, tag, description, inferServicePort, startCommand } = await form.validateFields();

    await saveImageMutation.mutateAsync({
      jobId,
      clusterId,
      imageName: name,
      imageTag: tag,
      imageDesc: description?.trim(),
      imageTypes: [ImageType.DEV_HOST],
      imageInferServicePort: inferServicePort?.toString(),
      imageStartCommand: startCommand,
    });
  };

  return (
    <Modal
      title={t(p("saveImage"))}
      open={open}
      onOk={form.submit}
      confirmLoading={saveImageMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={handleFinish}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
        initialValues={{
          types: [ImageType.APP], // 开发机默认为APP类型
        }}
      >
        <Form.Item label={t(p("originalName"))}>
          {imageName}
        </Form.Item>
        <Form.Item label={t(p("originalTag"))}>
          {imageTag || "latest"}
        </Form.Item>
        <Form.Item
          label={t(p("imageName"))}
          name="name"
          rules={[
            { required: true },
            { validator: imageNameValidation },
          ]}
        >
          <Input allowClear />
        </Form.Item>
        <Form.Item
          label={t(p("imageTag"))}
          name="tag"
          rules={[
            { required: true },
            { validator: imageTagValidation },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="description">
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
