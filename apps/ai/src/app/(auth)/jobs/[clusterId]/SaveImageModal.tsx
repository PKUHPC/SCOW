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

import { App, Form, Input, InputNumber, Modal, Select } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { getImageTexts, ImageType } from "src/models/Image";
import { AppSession } from "src/server/trpc/route/jobs/apps";
import { imageNameValidation, imageTagValidation, inputNumberFloorConfig } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  appSession: AppSession
  clusterId: string
}

interface FormFields {
  name: string,
  tag: string,
  types?: ImageType[],
  inferServicePort?: number,
  startCommand?: string,
  description?: string,
}

export const SaveImageModal: React.FC<Props> = (
  { open, onClose, reload, appSession, clusterId },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.saveImageModal.");
  const pCreate = prefix("app.image.createEditImageModal.");

  const TypeText = {
    APP: getImageTexts(t).APP,
    TRAIN: getImageTexts(t).TRAIN,
    INFER: getImageTexts(t).INFER,
  };

  const [form] = Form.useForm<FormFields>();
  const types = Form.useWatch("types", form);

  const { message } = App.useApp();

  const { data: jobParams, isLoading: isGetJobParamsLoading } = trpc.jobs.getCreateAppParams.useQuery(
    {
      clusterId,
      jobId:appSession.jobId,
      sessionId: appSession.sessionId,
    },
  );

  const imageId = jobParams?.image;
  const { data: imageData, isLoading: isGetImageDataLoading } = trpc.image.getImageById.useQuery(
    {
      imageId:imageId!,
    },
    {
      // 作业参数获取完且使用的本地镜像
      enabled: !isGetJobParamsLoading && !!imageId,
    },
  );

  const saveImageMutation = trpc.jobs.saveImage.useMutation({
    onSuccess() {
      message.success(t(p("saveSuccessfully")));
      onClose();
      form.resetFields();
      reload();
    },
    onError(e) {
      message.error(`${t(p("saveFailed"))}:${e.message}`);
    },
  });

  const handleFinish = async () => {

    const { name, tag, description,types,inferServicePort,startCommand } = await form.validateFields();

    await saveImageMutation.mutateAsync({
      jobId: appSession.jobId,
      clusterId,
      imageName: name,
      imageTag: tag,
      imageDesc: description?.trim(),
      imageTypes:types ?? [],
      imageInferServicePort:inferServicePort?.toString(),
      imageStartCommand:startCommand,
    });
  };

  return (
    <Modal
      title={t(p("saveImage"))}
      open={open}
      onOk={form.submit}
      confirmLoading={saveImageMutation.isLoading}
      onCancel={onClose}
      width={800}
      // 获取作业参数接口loading 或 使用的本地镜像时获取镜像数据接口loading
      loading={isGetJobParamsLoading || (!!jobParams?.image && isGetImageDataLoading)}
    >
      <Form
        form={form}
        onFinish={handleFinish}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
        initialValues={{
          types:imageData?.types,
          inferServicePort: Number(imageData?.inferServicePort),
          startCommand: jobParams?.startCommand ?? imageData?.startCommand,
        }}
      >
        <Form.Item label={t(p("originalName"))}>
          {appSession.image.name}
        </Form.Item>
        <Form.Item label={t(p("originalTag"))}>
          {appSession.image.tag || ""}
        </Form.Item>
        <Form.Item
          label={t(p("imageName"))}
          name="name"
          rules={[
            { required: true },
            { validator: imageNameValidation },
          ]}
        >
          <Input allowClear />
        </Form.Item>
        <Form.Item
          label={t(p("imageTag"))}
          name="tag"
          rules={[
            { required: true },
            { validator: imageTagValidation },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t(pCreate("type"))}
          name="types"
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
        {types?.includes(ImageType.INFER) && (
          <Form.Item
            label={t(pCreate("inferServicePort"))}
            name="inferServicePort"
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
        <Form.Item label={t(pCreate("startCommand"))} name="startCommand">
          <Input.TextArea />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="description">
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
