import { CustomFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput, RoundedInputNumber, RoundedTextArea } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { App, Form, type InputNumberProps } from "antd";
import React, { type ComponentType } from "react";
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
  newName: string;
  newTag: string;
  newTypes: ImageType[];
  newInferServicePort?: number;
  newStartCommand?: string;
  newDescription?: string;
}

const NumberRoundedInput = RoundedInputNumber as ComponentType<InputNumberProps<number>>;

export const CopyImageModal: React.FC<Props> = ({
  open,
  onClose,
  refetch,
  imageProps: {
    copiedId,
    copiedName,
    copiedTag,
    copiedClusterId,
    copiedTypes,
    copiedInferServicePort,
    copiedStartCommand,
    copiedDescription,
  },
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.copyImageModal.");
  const pCreate = prefix("app.image.createEditImageModal.");
  const pCommon = prefix("common.");
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
    const { newName, newTag, newTypes, newInferServicePort, newStartCommand, newDescription } =
      await form.validateFields();
    copyMutation.mutate({
      id: copiedId,
      newName,
      newTag,
      clusterId: copiedClusterId,
      newTypes,
      newInferServicePort: newInferServicePort?.toString(),
      newStartCommand,
      newDescription,
    });
  };

  const labelWidth = languageId === "zh_cn" ? 90 : 130;
  const renderLabel = (label: string) => <FormLabel style={{ whiteSpace: "nowrap" }}>{label}</FormLabel>;

  return (
    <AppRouterStyledModal
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
        colon={false}
        requiredMark={false}
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
        <CustomFormItem
          label={renderLabel(t(p("name")))}
          name="newName"
          rules={[{ required: true, message: t(pCommon("pleaseInput"), [t(p("name"))]) }, { validator: imageNameValidation }]}
        >
          <RoundedInput allowClear />
        </CustomFormItem>
        <CustomFormItem
          label={renderLabel(t(p("tag")))}
          name="newTag"
          rules={[{ required: true, message: t(pCommon("pleaseInput"), [t(p("tag"))]) }, { validator: imageTagValidation }]}
        >
          <RoundedInput />
        </CustomFormItem>
        <CustomFormItem
          label={renderLabel(t(pCreate("type")))}
          name="newTypes"
          rules={[{ required: true, message: t(pCommon("pleaseSelect"), [t(pCreate("type"))]) }]}
        >
          <RoundedSelect
            style={{ minWidth: "100px" }}
            mode="multiple"
            allowClear
            options={Object.entries(TypeText).map(([key, value]) => ({ label: value, value: key }))}
          />
        </CustomFormItem>
        {newTypes?.includes(ImageType.INFER) && (
          <CustomFormItem
            label={renderLabel(t(pCreate("inferServicePort")))}
            name="newInferServicePort"
            rules={[
              {
                required: true,
                message: t(pCommon("pleaseInput"), [t(pCreate("inferServicePort"))]),
                transform: (v) => Number(v),
                type: "integer",
              },
            ]}
          >
            <NumberRoundedInput min={1} max={65535} style={{ width: "100%" }} {...inputNumberFloorConfig} />
          </CustomFormItem>
        )}
        <CustomFormItem label={renderLabel(t(pCreate("startCommand")))} name="newStartCommand">
          <RoundedTextArea />
        </CustomFormItem>
        <CustomFormItem label={renderLabel(t(pCreate("description")))} name="newDescription">
          <RoundedTextArea />
        </CustomFormItem>
      </Form>
    </AppRouterStyledModal>
  );
};
