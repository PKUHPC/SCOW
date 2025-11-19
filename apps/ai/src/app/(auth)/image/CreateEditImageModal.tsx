import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TRPCClientError } from "@trpc/client";
import { App, Form, Input, InputNumber, Modal, Select } from "antd";
import React, { useEffect } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getImageTexts, getImageTypeText, ImageInterface, ImageType, Source } from "src/models/Image";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { createInterdependentValidator, imageNameValidation, imageTagValidation,
  inputNumberFloorConfig } from "src/utils/form";
import { trpc } from "src/utils/trpc";

import { defaultClusterContext } from "../defaultClusterContext";

export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isEdit: boolean;
  editData?: ImageInterface;
  clusters: Cluster[];
  currentClusterIds: string[];
}

interface FormFields {
  id?: number | undefined,
  cluster: Cluster,
  name: string,
  tag: string,
  description?: string,
  source: Source,
  sourcePath: string,
  userName?: string,
  password?: string,
  types: ImageType[],
  inferServicePort?: number,
  startCommand?: string,
}

export const CreateEditImageModal: React.FC<Props> = ({
  open, onClose, refetch, isEdit, editData, clusters, currentClusterIds,
}: Props) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.createEditImageModal.");
  const languageId = useI18n().currentLanguage.id;

  const sourceText = {
    INTERNAL: getImageTexts(t).INTERNAL,
    EXTERNAL: getImageTexts(t).EXTERNAL,
  };

  const TypeText = getImageTypeText(t);

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const { defaultCluster } = defaultClusterContext(clusters, currentClusterIds);

  useEffect(() => {
    resetForm();
  }, []);

  const resetForm = () => {
    if (isEdit && editData) {
      form.setFieldsValue({
        source: editData.source,
      });
    } else {
      form.setFieldsValue({
        source: Source.INTERNAL,
      });
    }
  };

  const cluster = Form.useWatch("cluster", form);
  const source = Form.useWatch("source", form);
  const types = Form.useWatch("types", form);

  const createMutation = trpc.image.createImage.useMutation({
    onSuccess() {
      message.success(t(p("alreadySubmit")));
      onClose();
      form.resetFields();
      resetForm();
      refetch();
    },
    onError(err) {
      if (err.data?.code === "UNPROCESSABLE_CONTENT") {
        message.error(t(p("notTar")));
        form.setFields([
          {
            name: "sourcePath",
            errors: [t(p("selectTar"))],
          },
        ]);
        return;
      }
      message.error(`${t(p("addFailed"))}, ${err.message}`);
    },
  });

  const editMutation = trpc.image.updateImage.useMutation({
    onSuccess() {
      message.success(t(p("editSuccess")));
      onClose();
      refetch();
    },
    onError(e) {
      const { data } = e as TRPCClientError<AppRouter>;
      if (data?.code === "NOT_FOUND") {
        message.error(t(p("notExisted")));
      } else {
        message.error(`${t(p("editFailed"))},${e.message}`);
      }
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { name, cluster, tag, description, source, sourcePath,userName,password,types,
      inferServicePort,startCommand } = await form.validateFields();
    if (isEdit && editData) {
      editMutation.mutate({
        id: editData.id,
        description,
        types,
        inferServicePort:inferServicePort?.toString(),
        startCommand,
      });
    } else {
      createMutation.mutate({
        name,
        clusterId: cluster.id,
        tag,
        description,
        source,
        sourcePath,
        userName,
        password,
        types,
        inferServicePort:inferServicePort?.toString(),
        startCommand,
      });
    };
  };

  return (
    <Modal
      title={isEdit ? t(p("editImage")) : t(p("addImage"))}
      open={open}
      onOk={form.submit}
      confirmLoading={isEdit ? editMutation.isLoading : createMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
        initialValues={(isEdit && editData) ? editData : { cluster: defaultCluster ?? "" }}
      >
        { (isEdit && editData) ? (
          <>
            <Form.Item
              label={t(p("imageName"))}
              name="name"
            >
              {editData.name}
            </Form.Item>
            <Form.Item
              label={t(p("imageTag"))}
              name="tag"
            >
              {editData.tag}
            </Form.Item>
            <Form.Item
              label={t(p("cluster"))}
            >
              {getI18nConfigCurrentText(
                clusters.find((x) => (x.id === editData.clusterId))?.name, languageId)
                      ?? editData.clusterId }
            </Form.Item>
            <Form.Item
              label={t(p("source"))}
            >
              {sourceText[editData.source]}
            </Form.Item>
          </>

        ) : (
          <>
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
              label={t(p("cluster"))}
              name="cluster"
              rules={[
                { required: true },
              ]}
            >
              <SingleClusterSelector />
            </Form.Item>
          </>
        )
        }
        <Form.Item
          label={t(p("type"))}
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
              Object.entries(TypeText).map(([key, value]) => ({ label:value, value:key }))
            }
          />
        </Form.Item>
        {types?.includes(ImageType.INFER) && (
          <Form.Item
            label={t(p("inferServicePort"))}
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
        { !isEdit && (
          <Form.Item
            label={t(p("source"))}
            name="source"
            rules={[
              { required: true },
            ]}
          >
            <Select
              style={{ minWidth: "100px" }}
              onChange={() => {
                form.setFieldsValue({ sourcePath: "" });
              }}
              options={
                Object.entries(sourceText).map(([key, value]) => ({ label:value, value:key }))}
            />
          </Form.Item>
        )}
        {!isEdit && (
          <>
            <Form.Item
              label={source === Source.INTERNAL ? t(p("selectImage")) : t(p("imageAddress")) }
              name="sourcePath"
              rules={[
                { required: true },
                () => ({
                  validator(_, value) {
                    if (!value) return Promise.resolve(); // 为空时交由 required 校验处理

                    if (source !== Source.INTERNAL) {

                      const ImageAddressRegex = new RegExp(
                        "^(?:[a-zA-Z0-9.-]+(?::\\d+)?\\/)?" + // 可选的 registry（如 docker.io, myregistry.com:5000）
                        "[a-z0-9._-]+(?:\\/[a-z0-9._-]+)*" + // 镜像名称（支持多级路径）
                        "(?::[a-zA-Z0-9._-]+|@sha256:[a-fA-F0-9]{64})?$", // 可选的 tag 或 sha256 digest
                      );

                      if (!ImageAddressRegex.test(value)) {
                        return Promise.reject(new Error(t(p("imageAddressIsIllegal")))); // 显示错误信息
                      }
                    }

                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input
                disabled={source === Source.INTERNAL}
                suffix={ source === Source.INTERNAL ?
                  (
                    <FileSelectModal
                      allowedFileType={["FILE"]}
                      onSubmit={(path: string) => {
                        form.setFields([{ name: "sourcePath", value: path, touched: true }]);
                        form.validateFields(["sourcePath"]);
                      }}
                      clusterId={cluster?.id ?? defaultCluster?.id ?? ""}
                    />
                  ) : undefined
                }
                placeholder={source === Source.INTERNAL ?
                  t(p("selectImagePlaceHolder")) : t(p("inputImagePlaceHolder"))}
              />
            </Form.Item>
            {
              source === Source.EXTERNAL ? (
                <>
                  <Form.Item
                    label={t(p("userName"))}
                    name="userName"
                    dependencies={["password"]}
                    rules={[createInterdependentValidator<FormFields>("password", t(p("userNamePlaceholder")))]}
                  >
                    <Input placeholder={t(p("userNameAndPassword"))} />
                  </Form.Item>
                  <Form.Item
                    label={t(p("password"))}
                    name="password"
                    dependencies={["userName"]}
                    rules={[createInterdependentValidator<FormFields>("userName", t(p("passwordPlaceholder")))]}
                  >
                    <Input.Password placeholder={t(p("userNameAndPassword"))} />
                  </Form.Item>
                </>
              ) : undefined
            }
          </>
        ) }
        <Form.Item label={t(p("startCommand"))} name="startCommand">
          <Input.TextArea />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="description">
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
