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
import { Cluster } from "src/server/trpc/route/config";
import { validateNoChinese } from "src/utils/form";
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
  modalId: number;
  cluster?: Cluster;
  modalName?: string;
  editData?: EditProps;
}

interface FormFields {
  versionName: string,
  versionDescription?: string,
  algorithmVersion?: string,
  path: string,
}

export const CreateAndEditVersionModal: React.FC<Props> = (
  { open, onClose, modalId, cluster, modalName, refetch, editData },
) => {
  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createModalVersionMutation = trpc.modal.createModalVersion.useMutation({
    onSuccess() {
      message.success("创建新版本成功");
      form.resetFields();
      onClose();
      refetch();
      form.resetFields();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error("版本名称已存在");
        form.setFields([
          {
            name: "versionName",
            errors: ["版本名称已存在"],
          },
        ]);
        return;
      }

      message.error("创建新版本失败");
    },
  });


  const updateModalVersionMutation = trpc.modal.updateModalVersion.useMutation({
    onSuccess() {
      message.success("修改版本成功");
      onClose();
      refetch();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error("版本名称已存在");
        form.setFields([
          {
            name: "versionName",
            errors: ["版本名称已存在"],
          },
        ]);
      }
      else if (e.data?.code === "NOT_FOUND") {
        message.error("模型或模型版本未找到");
      }
      else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error("有正在分享或正在取消分享的数据存在，请稍后再试");
      }
      else {
        message.error("修改版本失败");
      }
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { versionName, versionDescription, algorithmVersion, path } = await form.validateFields();
    if (editData?.versionName && editData.versionId) {
      updateModalVersionMutation.mutate({
        id:editData.versionId,
        versionName,
        versionDescription,
        algorithmVersion,
        modalId,
      });
    }
    else {
      createModalVersionMutation.mutate({
        versionName,
        versionDescription,
        algorithmVersion,
        path,
        modalId,
      });
    }
  };

  return (
    <Modal
      title={editData?.versionName ? "编辑版本" : "创建新版本"}
      open={open}
      onOk={form.submit}
      confirmLoading={createModalVersionMutation.isLoading || updateModalVersionMutation.isLoading}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
      >
        <Form.Item
          label="模型名称"
        >
          {modalName}
        </Form.Item>
        <Form.Item
          label="集群"
        >
          {getI18nConfigCurrentText(cluster?.name, undefined)}
        </Form.Item>
        <Form.Item
          label="版本名称"
          name="versionName"
          rules={[
            { required: true },
            { validator:validateNoChinese },
          ]}
          initialValue={editData?.versionName}
        >
          <Input />
        </Form.Item>
        <Form.Item label="版本描述" name="versionDescription" initialValue={editData?.versionDescription}>
          <Input.TextArea />
        </Form.Item>
        <Form.Item label="算法版本" name="algorithmVersion" initialValue={editData?.algorithmVersion}>
          <Input.TextArea />
        </Form.Item>
        {
          !editData?.versionId ? (
            <Form.Item
              label="上传模型"
              name="path"
              rules={[{ required: true }]}
            >
              <Input
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
