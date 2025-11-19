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
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface EditProps {
  versionName?: string;
  versionId?: number;
  versionDescription?: string;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  algorithmId: number;
  algorithmName: string | undefined;
  cluster?: Cluster;
  refetch: () => void;
  editData?: EditProps;
}

interface FormFields {
  versionName: string,
  versionDescription?: string,
  path: string,
}

export const CreateAndEditVersionModal: React.FC<Props> = (
  { open, onClose, algorithmId, algorithmName, refetch, cluster, editData },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.algorithm.CreateAndEditVersionModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createAlgorithmVersionMutation = trpc.algorithm.createAlgorithmVersion.useMutation({
    onSuccess() {
      message.success(t(p("addSuccessfully")));
      form.resetFields();
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
        return;
      } else if (e.data?.code === "BAD_REQUEST") {
        message.error(t(p("addressNotFound")));
        form.setFields([
          {
            name: "name",
            errors: [t(p("addressNotFound"))],
          },
        ]);
      } else {
        message.error(e.message);
      }
    },
  });


  const updateAlgorithmVersionMutation = trpc.algorithm.updateAlgorithmVersion.useMutation({
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
            errors: [t(p("notFound"))],
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
        message.error(t(p("editFailed")));
      }
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { versionName, versionDescription, path } = await form.validateFields();
    if (editData?.versionName && editData.versionId) {
      updateAlgorithmVersionMutation.mutate({
        algorithmVersionId:editData.versionId,
        versionName,
        versionDescription,
        algorithmId,
      });
    }
    else {
      createAlgorithmVersionMutation.mutate({
        versionName,
        versionDescription,
        path,
        algorithmId,
      });
    }
  };

  return (
    <Modal
      title={editData?.versionName ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={createAlgorithmVersionMutation.isLoading || updateAlgorithmVersionMutation.isLoading}
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
          {algorithmName}
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
          <Input allowClear />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="versionDescription" initialValue={editData?.versionDescription}>
          <Input.TextArea />
        </Form.Item>
        {
          !editData?.versionName ? (
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
