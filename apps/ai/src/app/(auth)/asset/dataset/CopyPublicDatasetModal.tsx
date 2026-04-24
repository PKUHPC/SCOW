import { CustomFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput, RoundedTextArea } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form } from "antd";
import React from "react";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetVersionInterface } from "src/server/trpc/route/dataset/datasetVersion";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

export interface Props {
  open: boolean;
  onClose: () => void;
  datasetId: number;
  datasetName: string | undefined;
  datasetVersionId: number;
  data: DatasetVersionInterface;
  cluster?: Cluster;
}

interface FormFields {
  versionName: string;
  versionDescription?: string;
  targetPath: string;
  targetDatasetName: string;
}

export const CopyPublicDatasetModal: React.FC<Props> = ({ open, onClose, data, datasetId, datasetName, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.copyPublicDatasetModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const copyMutation = trpc.dataset.copyPublicDatasetVersion.useMutation({
    onSuccess() {
      message.success(t(p("copySuccessfully")));
      onClose();
      form.resetFields();
    },
    onError(err) {
      const errCode = err.data?.code;
      const errMessage = err.message;
      if (errMessage === "Access denied to the dataset version files; copying is not allowed.") {
        message.error(t(p("noAccessCopy")));
        return;
      }
      if (errCode === "CONFLICT" && errMessage.startsWith("A dataset with the same name")) {
        form.setFields([
          {
            name: "targetDatasetName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
        return;
      }

      message.error(err.message);
    },
  });

  const onOk = async () => {
    const { targetPath, targetDatasetName, versionName, versionDescription } = await form.validateFields();
    copyMutation.mutate({
      datasetId,
      datasetName: targetDatasetName,
      path: targetPath,
      datasetVersionId: data.id,
      versionName,
      versionDescription: versionDescription ?? "",
    });
  };

  const labelWidth = languageId === "zh_cn" ? 120 : 160;
  const renderLabel = (label: string) => <FormLabel>{label}</FormLabel>;

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
        initialValues={data}
      >
        <CustomFormItem label={renderLabel(t(p("sourceName")))}>{datasetName}</CustomFormItem>
        <CustomFormItem
          label={renderLabel(t(p("targetName")))}
          name="targetDatasetName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
          initialValue={`${datasetName}`}
        >
          <RoundedInput allowClear />
        </CustomFormItem>
        <CustomFormItem label={renderLabel(t(p("cluster")))}>
          {getI18nConfigCurrentText(cluster?.name, languageId)}
        </CustomFormItem>
        <CustomFormItem
          label={renderLabel(t(p("versionName")))}
          name="versionName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
        >
          <RoundedInput allowClear />
        </CustomFormItem>
        <CustomFormItem label={renderLabel(t(p("versionDescription")))} name="versionDescription">
          <RoundedTextArea />
        </CustomFormItem>
        <CustomFormItem label={renderLabel(t(p("address")))} name="targetPath" rules={[{ required: true }]}>
          <RoundedInput
            disabled={true}
            suffix={
              <FileSelectModal
                allowedFileType={["DIR"]}
                onSubmit={(path: string) => {
                  form.setFields([{ name: "targetPath", value: path, touched: true }]);
                  form.validateFields(["targetPath"]);
                }}
                clusterId={cluster?.id ?? ""}
              />
            }
          />
        </CustomFormItem>
      </Form>
    </AppRouterStyledModal>
  );
};
