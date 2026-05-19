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
  isEdit?: boolean;
  editData?: DatasetVersionInterface;
  cluster?: Cluster;
  refetch: () => void;
  isPlatformOwned?: boolean;
  usePublicPath?: boolean;
}

interface FormFields {
  versionName: string;
  versionDescription?: string;
  path: string;
}

export const CreateEditDSVersionModal: React.FC<Props> = ({
  open,
  onClose,
  datasetId,
  datasetName,
  isEdit,
  editData,
  cluster,
  refetch,
  isPlatformOwned,
  usePublicPath,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.createEditDSVersionModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createMutation = trpc.dataset.createDatasetVersion.useMutation({
    onSuccess() {
      message.success(t(p("addSuccessfully")));
      onClose();
      form.resetFields();
      refetch();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "versionName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
      } else if (e.data?.code === "BAD_REQUEST") {
        message.error(t(p("addressNotFound")));
        form.setFields([
          {
            name: "path",
            errors: [t(p("addressNotFound"))],
          },
        ]);
      } else {
        message.error(e.message);
      }
    },
  });

  const editMutation = trpc.dataset.updateDatasetVersion.useMutation({
    onSuccess() {
      message.success(t(p("editSuccessfully")));
      onClose();
      refetch();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "versionName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
      } else if (e.data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error(t(p("tryLater")));
      } else {
        message.success(t(p("editFailed")));
      }
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { versionName, versionDescription, path } = await form.validateFields();

    if (isEdit && editData) {
      editMutation.mutate({
        datasetVersionId: editData.id,
        versionName,
        versionDescription,
        datasetId: editData.datasetId,
        ...(isPlatformOwned ? { isPlatformOwned: true } : {}),
      });
    } else {
      createMutation.mutate({
        versionName,
        versionDescription,
        path,
        datasetId,
        ...(isPlatformOwned ? { isPlatformOwned: true } : {}),
      });
    }
  };

  const labelWidth = languageId === "zh_cn" ? 80 : 140;
  const renderLabel = (label: string) => <FormLabel>{label}</FormLabel>;

  return (
    <AppRouterStyledModal
      title={isEdit ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={createMutation.isPending || editMutation.isPending}
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
        initialValues={editData}
      >
        <CustomFormItem label={renderLabel(t(p("name")))}>{datasetName}</CustomFormItem>
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
        <CustomFormItem label={renderLabel(t(p("description")))} name="versionDescription">
          <RoundedTextArea />
        </CustomFormItem>
        {!isEdit && (
          <>
            <CustomFormItem label={renderLabel(t(p("select")))} name="path" rules={[{ required: true }]}>
              <RoundedInput
                disabled={true}
                placeholder={t(p("selectDatasetFolder"))}
                suffix={
                  <FileSelectModal
                    allowedFileType={["DIR"]}
                    onSubmit={(path: string) => {
                      form.setFields([{ name: "path", value: path, touched: true }]);
                      form.validateFields(["path"]);
                    }}
                    clusterId={cluster?.id ?? ""}
                    usePublicPath={usePublicPath}
                  />
                }
              />
            </CustomFormItem>
          </>
        )}
      </Form>
    </AppRouterStyledModal>
  );
};
