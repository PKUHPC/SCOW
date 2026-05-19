import type { GetTenantAppsSchema } from "src/pages/api/tenant/authorization/getTenantApps";

import { PlusOutlined } from "@ant-design/icons";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Modal, Select } from "antd";
import React, { useEffect, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { UpdateDefaultAppAction } from "src/models/app";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";

interface FormProps {
  appId: string;
}

interface ModalProps {
  clusterId: string;
  tenantName: string;
  defaultAppsData: Static<(typeof GetTenantAppsSchema)["responses"]["200"]> | undefined;
  open: boolean;
  close: () => void;
  refresh: () => void;
  onAdd: (clusterId: string, appId: string) => Promise<void>;
}

const p = prefix("pageComp.tenant.defaultApps.defaultAppsTable.addToDefaultApps.");

const NewAppModal: React.FC<ModalProps> = ({
  clusterId,
  tenantName,
  defaultAppsData,
  open,
  close,
  onAdd: onAdding,
}) => {
  const t = useI18nTranslateToString();
  const { publicConfigClusters } = useStore(ClusterInfoStore);
  const [placeholder, setPlaceholder] = useState<string>(t(p("appDefaultPlaceholder")));

  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormProps>();
  const languageId = useI18n().currentLanguage.id;

  const clusterName = getClusterName(clusterId, languageId, publicConfigClusters);

  useEffect(() => {
    const selectableApps = defaultAppsData?.tenantApps?.filter((x) => !x.isDefault);
    if (selectableApps?.length === 0) {
      setPlaceholder(t(p("noAppsPlaceholder")));
    } else {
      setPlaceholder(t(p("appDefaultPlaceholder")));
    }
  }, [clusterId, defaultAppsData]);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  return (
    <Modal
      title={t(p("title"))}
      open={open}
      onCancel={close}
      onOk={async () => {
        const { appId } = await form.validateFields();
        setLoading(true);
        onAdding(clusterId, appId).finally(() => setLoading(false));
      }}
      confirmLoading={loading}
    >
      <>
        <div style={{ marginTop: "10px" }}>
          <span>
            {t(p("tenant"))}：<strong>{tenantName}</strong>
          </span>
          <Divider type="vertical" />
          <span>
            {t(p("cluster"))}：<strong>{clusterName}</strong>
          </span>
        </div>
        <p style={{ color: "red" }}>{t(p("modalWarn"))}</p>
      </>
      <Form form={form}>
        <Form.Item name="appId" label={t(p("app"))} rules={[{ required: true }]}>
          <Select placeholder={placeholder}>
            {defaultAppsData?.tenantApps
              ?.filter((x) => !x.isDefault)
              ?.map((option) => (
                <Select.Option key={option.id} value={option.id}>
                  {option.name}
                </Select.Option>
              ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface Props {
  clusterId: string;
  tenantName: string;
  defaultAppsData: Static<(typeof GetTenantAppsSchema)["responses"]["200"]> | undefined;
  refresh: () => void;
}

export const AddToDefaultAppsButton: React.FC<Props> = ({ clusterId, tenantName, defaultAppsData, refresh }) => {
  const t = useI18nTranslateToString();
  const { message } = App.useApp();
  const [modalShow, setModalShow] = useState(false);

  const onAdd = async (clusterId: string, appId: string) => {
    await api
      .updateDefaultApp({
        body: {
          clusterId,
          appId,
          appName: defaultAppsData?.tenantApps?.find((x) => x.id === appId)?.name ?? "",
          updateAction: UpdateDefaultAppAction.ADD_TO_DEFAULT_APPS,
        },
      })
      .then((res) => {
        if (res.executed) {
          message.success(t(p("addSuccessMessage")));
          setModalShow(false);
          refresh();
        } else {
          message.error(res.reason || t(p("addFailedMessage")));
        }
      });
  };

  return (
    <>
      <NewAppModal
        close={() => setModalShow(false)}
        open={modalShow}
        refresh={refresh}
        clusterId={clusterId}
        tenantName={tenantName}
        defaultAppsData={defaultAppsData}
        onAdd={onAdd}
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalShow(true)}>
        {t("common.add")}
      </Button>
    </>
  );
};
