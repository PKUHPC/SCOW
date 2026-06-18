import { CustomFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput, RoundedTextArea } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form } from "antd";
import React, { useEffect } from "react";
import { useDefaultCluster } from "src/app/(auth)/defaultClusterContext";
import { RoundedSingleClusterSelector } from "src/components/ClusterSelector";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getDatasetTexts } from "src/models/Dateset";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isEdit: boolean;
  editData?: DatasetInterface;
  clusters: Cluster[];
  isPlatformOwned?: boolean;
}

interface FormFields {
  id?: number | undefined;
  name: string;
  cluster: Cluster;
  type: string;
  scene: string;
  description?: string;
}

export const CreateEditDatasetModal: React.FC<Props> = ({
  open,
  onClose,
  refetch,
  isEdit,
  editData,
  clusters,
  isPlatformOwned,
}) => {
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

  const { defaultCluster } = useDefaultCluster();

  useEffect(() => {
    resetForm();
  }, []);

  const resetForm = () => {
    if (isEdit && editData) {
      form.setFieldsValue({
        type: editData.type,
        scene: editData.scene,
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
      } else if (e.data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error(t(p("tryLater")));
      } else {
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
        ...(isPlatformOwned ? { isPlatformOwned: true } : {}),
      });
    } else {
      createMutation.mutate({
        name,
        clusterId: cluster.id,
        type,
        description,
        scene,
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
      confirmLoading={isEdit ? editMutation.isPending : createMutation.isPending}
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
        initialValues={isEdit && editData ? editData : {}}
      >
        <CustomFormItem
          label={renderLabel(t(p("name")))}
          name="name"
          rules={[
            { required: true, message: t(pCommon("pleaseInput"), [t(p("name"))]) },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
        >
          <RoundedInput />
        </CustomFormItem>
        {isEdit && editData ? (
          <CustomFormItem label={renderLabel(t(p("cluster")))}>
            {getI18nConfigCurrentText(clusters.find((x) => x.id === editData.clusterId)?.name, languageId) ??
              editData.clusterId}
          </CustomFormItem>
        ) : (
          <CustomFormItem
            label={renderLabel(t(p("cluster")))}
            name="cluster"
            rules={[{ required: true, message: t(pCommon("pleaseSelect"), [t(p("cluster"))]) }]}
            initialValue={defaultCluster}
          >
            <RoundedSingleClusterSelector />
          </CustomFormItem>
        )}
        <CustomFormItem
          label={renderLabel(t(p("type")))}
          name="type"
          rules={[{ required: true, message: t(p("selectType")) }]}
        >
          <RoundedSelect
            style={{ minWidth: "100px" }}
            options={Object.entries(DatasetTypeTextTrans).map(([key, value]) => ({ label: value, value: key }))}
          />
        </CustomFormItem>
        <CustomFormItem
          label={renderLabel(t(p("scene")))}
          name="scene"
          rules={[{ required: true, message: t(p("selectScene")) }]}
        >
          <RoundedSelect
            style={{ minWidth: "100px" }}
            options={Object.entries(SceneTypeTextTrans).map(([key, value]) => ({ label: value, value: key }))}
          />
        </CustomFormItem>
        <CustomFormItem label={renderLabel(t(p("description")))} name="description">
          <RoundedTextArea />
        </CustomFormItem>
      </Form>
    </AppRouterStyledModal>
  );
};
