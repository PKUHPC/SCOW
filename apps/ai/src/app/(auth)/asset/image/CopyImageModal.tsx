import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Input, InputNumber, Modal, Select } from "antd";
import React from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getImageTypeText, ImageType } from "src/models/Image";
import { imageNameValidation, imageTagValidation, inputNumberFloorConfig } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface ImageProps {
  copiedId: number;
  copiedName: string;
  copiedTag: string;
  copiedClusterId?: string;
  copiedTypes: ImageType[];
  copiedInferServicePort?: number;
  copiedStartCommand?: string;
  copiedDescription?: string;
}

export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  imageProps: ImageProps;
}

interface FormFields {
  newName: string,
  newTag: string,
  newTypes: ImageType[],
  newInferServicePort?: number,
  newStartCommand?: string,
  newDescription?: string,
}

export const CopyImageModal: React.FC<Props> = (
  { open,
    onClose,
    refetch,
    imageProps:
      {
        copiedId,
        copiedName,
        copiedTag,
        copiedClusterId,
        copiedTypes,
        copiedInferServicePort,
        copiedStartCommand,
        copiedDescription,
      },
  },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.copyImageModal.");
  const pCreate = prefix("app.image.createEditImageModal.");
  const languageId = useI18n().currentLanguage.id;

  const TypeText = getImageTypeText(t);

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const initialValues: FormFields = {
    newName: copiedName,
    newTag: copiedTag,
    newTypes: copiedTypes,
    newInferServicePort: copiedInferServicePort,
    newStartCommand: copiedStartCommand,
    newDescription: copiedDescription,
  };

  const newTypes = Form.useWatch("newTypes", form);

  const copyMutation = trpc.image.copyImage.useMutation({
    onSuccess() {
      message.success(t(p("success")));
      onClose();
      form.resetFields();
      refetch();
    },
    onError(e) {
      if (e.message === "Access denied to image files; copying is not allowed.") {
        message.error(t(p("noAccessCopy")));
        return;
      }
      message.error(`${t(p("failed"))}:${e.message}`);
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { newName, newTag,newTypes,newInferServicePort,newStartCommand,newDescription } = await form.validateFields();
    copyMutation.mutate({
      id: copiedId,
      newName,
      newTag,
      clusterId:copiedClusterId,
      newTypes,
      newInferServicePort:newInferServicePort?.toString(),
      newStartCommand,
      newDescription,
    });
  };

  const labelWidth = languageId === "zh_cn" ? 90 : 130;

  return (
    <Modal
      title={t(p("copy"))}
      open={open}
      onOk={form.submit}
      confirmLoading={copyMutation.isPending}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        layout="horizontal"
        labelAlign="left"
        labelCol={{
          flex: `0 0 ${labelWidth}px`,
        }}
        wrapperCol={{
          flex: "1 1 auto",
          style: {
            marginLeft: "16px",
          },
        }}
        initialValues={{ ...initialValues }}
      >
        <Form.Item
          label={t(p("name"))}
          name="newName"
          rules={[
            { required: true },
            { validator: imageNameValidation },
          ]}
        >
          <TrimInput allowClear />
        </Form.Item>
        <Form.Item
          label={t(p("tag"))}
          name="newTag"
          rules={[
            { required: true },
            { validator: imageTagValidation },
          ]}
        >
          <TrimInput />
        </Form.Item>
        <Form.Item
          label={t(pCreate("type"))}
          name="newTypes"
          rules={[
            { required: true },
          ]}
        >
          <Select
            style={{ minWidth: "100px" }}
            mode="multiple"
            allowClear
            options={
              Object.entries(TypeText).map(([key, value]) => ({ label:value, value:key }))}
          />
        </Form.Item>
        {newTypes?.includes(ImageType.INFER) && (
          <Form.Item
            label={t(pCreate("inferServicePort"))}
            name="newInferServicePort"
            rules={[
              {
                required: true,
                transform: (v) => Number(v),
                type: "integer",
              },
            ]}
          >
            <InputNumber
              min={1}
              max={65535}
              style={{ width: "100%" }}
              {...inputNumberFloorConfig}
            />
          </Form.Item>
        )}
        <Form.Item label={t(pCreate("startCommand"))} name="newStartCommand">
          <Input.TextArea />
        </Form.Item>
        <Form.Item label={t(pCreate("description"))} name="newDescription">
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
