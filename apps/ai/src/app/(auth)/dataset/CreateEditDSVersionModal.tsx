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
}

interface FormFields {
  versionName: string,
  versionDescription?: string,
  path: string,
}

export const CreateEditDSVersionModal: React.FC<Props> = (
  { open, onClose, datasetId, datasetName, isEdit, editData, cluster, refetch },
) => {
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
      });
    } else {
      createMutation.mutate({
        versionName,
        versionDescription,
        path,
        datasetId,
      });
    }
  };


  return (
    <Modal
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
        wrapperCol={{ span: 19 }}
        labelCol={{ span: 5 }}
        initialValues={editData}
      >
        <Form.Item
          label={t(p("name"))}
        >
          {datasetName}
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
        <Form.Item label={t(p("description"))} name="versionDescription">
          <Input.TextArea />
        </Form.Item>
        {
          !isEdit && (
            <>
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
            </>
          )
        }
      </Form>
    </Modal>
  );
};
