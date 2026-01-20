import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, Modal, Select } from "antd";
import React, { useEffect } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DatasetType, getDatasetTexts, SceneType } from "src/models/Dateset";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

import { defaultClusterContext } from "../../defaultClusterContext";

export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isEdit: boolean;
  editData?: DatasetInterface;
  clusters: Cluster[];
  currentClusterIds: string[];
}

interface FormFields {
  id?: number | undefined,
  name: string,
  cluster: Cluster,
  type: string,
  scene: string,
  description?: string,
}

export const CreateEditDatasetModal: React.FC<Props> = (
  { open, onClose, refetch, isEdit, editData, clusters, currentClusterIds },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.createEditDatasetModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const DatasetTypeTextTrans: Record<string, string> = {
    IMAGE: getDatasetTexts(t).image,
    TEXT: getDatasetTexts(t).text,
    VIDEO: getDatasetTexts(t).video,
    AUDIO: getDatasetTexts(t).audio,
    OTHER: getDatasetTexts(t).other,
  };

  const SceneTypeTextTrans = {
    CWS: getDatasetTexts(t).ces,
    DA: getDatasetTexts(t).da,
    IC: getDatasetTexts(t).ic,
    OD: getDatasetTexts(t).od,
    OTHER: getDatasetTexts(t).other,
  };

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const { defaultCluster } = defaultClusterContext(clusters, currentClusterIds);

  useEffect(() => {
    resetForm();
  }, []);

  const resetForm = () => {
    if (isEdit && editData) {
      form.setFieldsValue({
        type: editData.type,
        scene: editData.scene,
      });
    } else {
      form.setFieldsValue({
        type: DatasetType.IMAGE,
        scene: SceneType.CWS,
      });
    }
  };

  const createMutation = trpc.dataset.createDataset.useMutation({
    onSuccess() {
      message.success(t(p("addSuccessfully")));
      onClose();
      form.resetFields();
      resetForm();
      refetch();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "name",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
        return;
      }

      message.error(t(p("addFailed")));
    },
  });

  const editMutation = trpc.dataset.updateDataset.useMutation({
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
            name: "name",
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
        message.error(t(p("editFailed")));
      }
    },
  });

  const onOk = async () => {
    const { name, type, description, scene, cluster } = await form.validateFields();
    if (isEdit && editData) {

      editMutation.mutate({
        id: editData.id,
        name,
        type,
        scene,
        description,
      });
    } else {
      createMutation.mutate({
        name,
        clusterId: cluster.id,
        type,
        description,
        scene,
      });
    }
  };

  return (
    <Modal
      title={isEdit ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={isEdit ? editMutation.isPending : createMutation.isPending}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 19 }}
        labelCol={{ span: 5 }}
        initialValues={isEdit && editData ? editData : { cluster: defaultCluster }}
      >
        <Form.Item
          label={t(p("name"))}
          name="name"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
        >
          <Input allowClear />
        </Form.Item>
        {isEdit && editData ? (
          <Form.Item
            label={t(p("cluster"))}
          >
            {getI18nConfigCurrentText(
              clusters.find((x) => (x.id === editData.clusterId))?.name, languageId)
                      ?? editData.clusterId }
          </Form.Item>
        ) : (
          <Form.Item
            label={t(p("cluster"))}
            name="cluster"
            rules={[
              { required: true },
            ]}
          >
            <SingleClusterSelector />
          </Form.Item>
        )
        }
        <Form.Item label={t(p("type"))} name="type" required={true}>
          <Select
            style={{ minWidth: "100px" }}
            options={
              Object.entries(DatasetTypeTextTrans).map(([key, value]) => ({ label:value, value:key }))}
          />
        </Form.Item>
        <Form.Item label={t(p("scene"))} name="scene" required={true}>
          <Select
            style={{ minWidth: "100px" }}
            options={
              Object.entries(SceneTypeTextTrans).map(([key, value]) => ({ label:value, value:key }))}
          />
        </Form.Item>
        <Form.Item label={t(p("description"))} name="description">
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
