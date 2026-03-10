import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, Modal } from "antd";
import React from "react";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AlgorithmVersionInterface } from "src/models/Algorithm";
import { Cluster } from "src/server/trpc/route/config";
import { createNoChineseValidator,createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

export interface Props {
  open: boolean;
  data: AlgorithmVersionInterface;
  algorithmId: number;
  algorithmVersionId: number;
  algorithmName: string | undefined;
  cluster?: Cluster;
  onClose: () => void;
}

interface FormFields {
  targetAlgorithmName: string;
  versionName: string,
  versionDescription?: string,
  path: string,
}

export const CopyPublicAlgorithmModal: React.FC<Props> = (
  { open, onClose, algorithmId, algorithmVersionId, algorithmName, cluster, data },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.algorithm.copyPublicAlgorithmModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const copyMutation = trpc.algorithm.copyPublicAlgorithmVersion.useMutation({
    onSuccess() {
      message.success(t(p("copySuccessfully")));
      onClose();
    },
    onError(err) {
      const errCode = err.data?.code;
      const errMessage = err.message;
      if (errCode === "CONFLICT" && errMessage.startsWith("An algorithm with the same name")) {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "targetAlgorithmName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
        return;
      }

      message.error(err.message);
    },
  });

  const onOk = async () => {
    const { targetAlgorithmName, versionName, versionDescription, path } = await form.validateFields();
    copyMutation.mutate({
      algorithmId,
      algorithmVersionId,
      algorithmName: targetAlgorithmName,
      versionName,
      versionDescription: versionDescription ?? "",
      path,
    });
  };

  return (
    <Modal
      title={t(p("copy"))}
      open={open}
      onOk={form.submit}
      confirmLoading={copyMutation.isPending}
      onCancel={onClose}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 18 }}
        labelCol={{ span: 6 }}
      >
        <Form.Item
          label={t(p("sourceName"))}
        >
          {algorithmName}
        </Form.Item>
        <Form.Item
          label={t(p("targetName"))}
          name="targetAlgorithmName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
        >
          <TrimInput allowClear />
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
          initialValue={data?.versionName}
        >
          <TrimInput allowClear />
        </Form.Item>
        <Form.Item label={t(p("versionDescription"))} name="versionDescription" initialValue={data?.versionDescription}>
          <Input.TextArea />
        </Form.Item>
        <Form.Item
          label={t(p("address"))}
          name="path"
          rules={[{ required: true }]}
        >
          <TrimInput
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
      </Form>
    </Modal>
  );
};
