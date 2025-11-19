import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, Modal } from "antd";
import React from "react";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface EditProps {
  versionId: number;
  versionName: string;
  versionDescription?: string;
  algorithmVersion?: string;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  modelId: number;
  cluster?: Cluster;
  modelName?: string;
  editData?: EditProps;
}

interface FormFields {
  versionName: string,
  versionDescription?: string,
  algorithmVersion?: string,
  path: string,
}

export const CreateAndEditVersionModal: React.FC<Props> = (
  { open, onClose, modelId, cluster, modelName, refetch, editData },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.createAndEditVersionModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createModelVersionMutation = trpc.model.createModelVersion.useMutation({
    onSuccess() {
      message.success(t(p("addSuccessfully")));
      form.resetFields();
      onClose();
      refetch();
      form.resetFields();
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
        message.error(t(p("addFailed")));
      }
    },
  });


  const updateModelVersionMutation = trpc.model.updateModelVersion.useMutation({
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
      }
      else if (e.data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      }
      else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error(t(p("tryLater")));
      }
      else {
        message.error(e.message);
      }
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { versionName, versionDescription, algorithmVersion, path } = await form.validateFields();
    if (editData?.versionName && editData.versionId) {
      updateModelVersionMutation.mutate({
        versionId: editData.versionId,
        versionName,
        versionDescription,
        algorithmVersion,
        modelId,
      });
    }
    else {
      createModelVersionMutation.mutate({
        versionName,
        versionDescription,
        algorithmVersion,
        path,
        modelId,
      });
    }
  };

  return (
    <Modal
      title={editData?.versionName ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={createModelVersionMutation.isLoading || updateModelVersionMutation.isLoading}
      onCancel={onClose}
      destroyOnClose
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
      >
        <Form.Item
          label={t(p("name"))}
        >
          {modelName}
        </Form.Item>
        <Form.Item
          label={t(p("cluster"))}
        >
          {getI18nConfigCurrentText(cluster?.name, languageId)}
        </Form.Item>
        <Form.Item
          label={t(p("versionName"))}
          name="versionName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
          initialValue={editData?.versionName}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="versionDescription" initialValue={editData?.versionDescription}>
          <Input.TextArea />
        </Form.Item>
        <Form.Item label={t(p("algorithmVersion"))} name="algorithmVersion" initialValue={editData?.algorithmVersion}>
          <Input.TextArea />
        </Form.Item>
        {
          !editData?.versionId ? (
            <Form.Item
              label={t(p("select"))}
              name="path"
              rules={[{ required: true }]}
            >
              <Input
                disabled={true}
                suffix={
                  (
                    <FileSelectModal
                      allowedFileType={["DIR"]}
                      onSubmit={(path: string) => {
                        form.setFields([{ name: "path", value: path, touched: true }]);
                        form.validateFields(["path"]);
                      }}
                      clusterId={cluster?.id ?? ""}
                    />
                  )
                }
              />
            </Form.Item>
          ) : undefined
        }

      </Form>
    </Modal>
  );
};
