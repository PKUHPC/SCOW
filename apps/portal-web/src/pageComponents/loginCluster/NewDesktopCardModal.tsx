import { AvailableWm } from "@scow/protos/build/portal/desktop";
import { App, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { openDesktop } from "src/utils/vnc";

interface Cluster {
  id: string;
  name: string;
  description?: string;
  shadowdeskEnabled?: boolean;
  hasShadowdeskConfig?: boolean;
  shadowdeskAvailableWms?: string[];
}

interface WmsItem {
  clusterId: string;
  wms: AvailableWm[];
}

type LoginNodes = Record<string, { address: string; name: string }[]>;

export interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  clusters: Cluster[];
  allAvailableWms: WmsItem[];
  loginNodes: LoginNodes;
}

interface FormInfo {
  cluster: string;
  loginNode: string;
  wm: string;
  desktopName: string;
  remoteControlTool: "shadowdesk" | "vnc" | undefined;
}

const p = prefix("pageComp.loginCluster.newDesktopCardModal.");

export const NewDesktopCardModal: React.FC<Props> = ({
  open,
  onClose,
  reload,
  clusters,
  allAvailableWms,
  loginNodes,
}) => {
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormInfo>();

  const { modal } = App.useApp();

  const [submitting, setSubmitting] = useState(false);
  const selectedClusterId = Form.useWatch("cluster", form);
  const currentRemoteControlTool = Form.useWatch("remoteControlTool", form);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);
  const hasShadowdeskConfig = selectedCluster?.hasShadowdeskConfig;
  const shadowdeskEnabled = selectedCluster?.shadowdeskEnabled;
  const hasShadowDesk = (hasShadowdeskConfig ? shadowdeskEnabled : publicConfig.SHADOW_DESK_ENABLED) || false;
  const shadowdeskAvailableWms = (
    hasShadowdeskConfig
      ? selectedCluster?.shadowdeskAvailableWms
      : publicConfig.SHADOW_DESK_WMS
  ) || [];

  // 从传入的allAvailableWms中查找当前选中集群的WM信息
  const availableWms = allAvailableWms.find((item) => item.clusterId === selectedClusterId)?.wms || [];

  const onOk = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    // Create new desktop
    await api.createDesktop({
      body: {
        cluster: values.cluster,
        loginNode: values.loginNode,
        wm: values.wm,
        desktopName: values.desktopName,
        remoteControlTool: values.remoteControlTool ?? "vnc",
      },
    }).httpError(409, (e) => {
      const { code } = e;
      if (code === "TOO_MANY_DESKTOPS") {
        modal.error({
          title: t(p("error.creatDesktopError")),
          content: t(p("error.tooManyVncContent")),
        });
      } else {
        throw e;
      }
    }).httpError(500, (e) => {
      const { code, message } = e;
      if (code === "INTERNAL_ERROR" && message.includes("desktop name already exists")) {
        modal.error({
          title: t(p("error.creatDesktopError")),
          content: `${values.desktopName} ${t(p("error.desktopNameAlreadyExists"))}`,
        });
      } else {
        throw e;
      }
    })
      .then((resp) => {
        if (resp.type === "shadowdesk") {
          window.open(resp.shadowdesk?.shadowdeskUrl);
        } else if (resp.vnc?.host && resp.vnc?.port && resp.vnc?.password) {
          openDesktop(values.cluster, resp.vnc.host, resp.vnc.port, resp.vnc.password);
        }
        onClose();
        reload();
      })
      .finally(() => { setSubmitting(false); });
  };

  // 设置远程控制工具的默认值
  useEffect(() => {
    if (selectedClusterId) {
      const defaultTool = hasShadowDesk ? "shadowdesk" : "vnc";
      form.setFieldsValue({ remoteControlTool: defaultTool });
    }
  }, [hasShadowDesk, selectedClusterId]);


  // 设置 loginNode 和 wm 的默认值
  useEffect(() => {
    // 确保集群已被选中
    if (!selectedClusterId) return;

    const loginNodeOptions = loginNodes[selectedClusterId] || [];

    const newDefaults: Partial<FormInfo> = {};

    // 设置默认登录节点
    if (loginNodeOptions.length > 0) {
      newDefaults.loginNode = loginNodeOptions[0]?.address;
    } else {
      newDefaults.loginNode = undefined;
    }

    // 设置默认 WM
    if (currentRemoteControlTool === "shadowdesk") {
      newDefaults.wm = shadowdeskAvailableWms[0];
    } else { // VNC
      newDefaults.wm = availableWms[0]?.wm;
    }

    form.setFieldsValue(newDefaults);

  }, [selectedClusterId, loginNodes, availableWms, shadowdeskAvailableWms, currentRemoteControlTool]);


  // 模态框打开时设置默认集群和桌面名称
  useEffect(() => {
    if (open) {
      // 1. 设置默认桌面名称
      form.setFieldValue("desktopName", `desktop-${dayjs().format("YYYYMMDD-HHmmss")}`);

      // 2. 设置默认集群（传入的clusters[0]必有值）
      const defaultCluster = clusters[0];
      if (defaultCluster) {
        form.setFieldValue("cluster", defaultCluster.id);
      }
      // 3. 重置其他依赖字段
      form.resetFields(["loginNode", "wm", "remoteControlTool"]);
    }
  }, [open, clusters]);

  const handleClusterChange = () => {
    // 仅清除依赖于集群的字段
    form.setFieldsValue({ loginNode: undefined, wm: undefined, remoteControlTool: undefined });
  };

  return (
    <Modal
      title={t(p("modal.createNewDesktop"))}
      open={open}
      onOk={form.submit}
      confirmLoading={submitting}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 17 }}
        labelCol={{ span: 6, style: { whiteSpace: "normal", lineHeight: "16px" } }}
      >
        <Form.Item
          label={t(p("modal.clusterName"))}
          name="cluster"
          rules={[{ required: true }]}
        >
          <Select
            showSearch
            optionFilterProp="children"
            options={clusters.map((cluster) => ({
              label: cluster.name, value: cluster.id,
            }))}
            onChange={handleClusterChange}
          />
        </Form.Item>

        {selectedClusterId && (
          <>
            <Form.Item label={t(p("modal.loginNode"))} name="loginNode" rules={[{ required: true }]}>
              <Select
                options={loginNodes[selectedClusterId]?.map((loginNode) => ({
                  label: loginNode.name, value: loginNode.address,
                })) || []}
              />
            </Form.Item>

            {hasShadowDesk && (
              <Form.Item label={t(p("modal.remoteControlTool"))} name="remoteControlTool" required>
                <Select
                  options={[{ label: "ShadowDesk", value: "shadowdesk" }, { label: "vnc", value: "vnc" }]}
                  onChange={(value) => {
                    form.setFieldValue("remoteControlTool", value);
                  }}
                />
              </Form.Item>
            )}

            <Form.Item label={t(p("modal.wm"))} name="wm" required>
              <Select
                options={
                  currentRemoteControlTool === "shadowdesk"
                    ? shadowdeskAvailableWms.map((item) => ({ label: item, value: item }))
                    : availableWms.map(({ name, wm }) => ({ label: name, value: wm }))
                }
              />
            </Form.Item>
            <Form.Item label={t(p("modal.desktopName"))} name="desktopName" required>
              <Input />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
