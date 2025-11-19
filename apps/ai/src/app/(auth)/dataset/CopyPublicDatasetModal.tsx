/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, Modal } from "antd";
import React from "react";
import { useUser } from "src/app/auth";
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
  versionName: string,
  versionDescription?: string,
  targetPath: string,
  targetDatasetName: string;
}

export const CopyPublicDatasetModal: React.FC<Props> = (
  { open, onClose, data, datasetId, datasetName, cluster },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.copyPublicDatasetModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();
  const user = useUser();

  const copyMutation = trpc.dataset.copyPublicDatasetVersion.useMutation({
    onSuccess() {
      message.success(t(p("copySuccessfully")));
      onClose();
      form.resetFields();
    },
    onError(err) {
      const errCode = err.data?.code;
      const errMessage = err.message;
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

  return (
    <Modal
      title={t(p("copy"))}
      open={open}
      onOk={form.submit}
      confirmLoading={copyMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 18 }}
        labelCol={{ span: 6 }}
        initialValues={data}
      >
        <Form.Item
          label={t(p("sourceName"))}
        >
          {datasetName}
        </Form.Item>
        <Form.Item
          label={t(p("targetName"))}
          name="targetDatasetName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
          initialValue={`${user.name}/${datasetName}`}
        >
          <Input allowClear />
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
        >
          <Input allowClear />
        </Form.Item>
        <Form.Item label={t(p("versionDescription"))} name="versionDescription">
          <Input.TextArea />
        </Form.Item>
        <Form.Item
          label={t(p("address"))}
          name="targetPath"
          rules={[{ required: true }]}
        >
          <Input
            disabled={true}
            suffix={
              (
                <FileSelectModal
                  allowedFileType={["DIR"]}
                  onSubmit={(path: string) => {
                    form.setFields([{ name: "targetPath", value: path, touched: true }]);
                    form.validateFields(["targetPath"]);
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
