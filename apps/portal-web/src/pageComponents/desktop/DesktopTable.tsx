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

import { PlusOutlined } from "@ant-design/icons";
import { I18nStringType } from "@scow/config/build/i18n";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Button, Form, Select, Table } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import React, { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DesktopTableActions } from "src/pageComponents/desktop/DesktopTableActions";
import { NewDesktopTableModal } from "src/pageComponents/desktop/NewDesktopTableModal";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { publicConfig } from "src/utils/config";

const NewDesktopTableModalButton = ModalButton(NewDesktopTableModal, { type: "primary", icon: <PlusOutlined /> });

interface Cluster { id: string; name: I18nStringType; shadowdeskEnabled?: boolean;
  hasShadowdeskConfig?: boolean; shadowdeskAvailableWms?: string[]; };

interface Props {
  loginDesktopEnabledClusters: Cluster[]
}

export interface DesktopItem {
  desktopId: number,
  desktopName: string,
  wm: string,
  createTime?: string,
  addr: string,
  remoteControlTool?: RemoteControlTool,
};

enum RemoteControlTool {
  VNC = 0,
  SHADOWDESK = 1,
}

const p = prefix("pageComp.desktop.desktopTable.");

export const DesktopTable: React.FC<Props> = ({ loginDesktopEnabledClusters }) => {

  const router = useRouter();

  const t = useI18nTranslateToString();

  const { currentClusters, defaultCluster } = useStore(ClusterInfoStore);

  if (!defaultCluster && currentClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const { loginNodes } = useStore(LoginNodeStore);
  const clusterQuery = queryToString(router.query.cluster);
  const loginQuery = queryToString(router.query.loginNode);

  const [selectedLoginNodeAddress, setSelectedLoginNodeAddress] = useState("");

  // 如果默认集群(不存在时优先选取可用集群中某一集群作为当前默认集群)没开启登录节点桌面功能，则取开启此功能的某一集群为默认集群
  const currentDefaultCluster = defaultCluster ?? currentClusters[0];
  const enabledDefaultCluster = loginDesktopEnabledClusters.find((x) => x.id === currentDefaultCluster.id)
    ? currentDefaultCluster
    : loginDesktopEnabledClusters[0];
  const cluster = currentClusters.find((x) => x.id === clusterQuery) ?? enabledDefaultCluster;
  const loginNode = loginNodes[cluster.id].find((x) => x.address === loginQuery) ?? undefined;
  // 是否在集群配置登录节点中配置了shadowdesk
  const hasShadowdeskConfig = loginDesktopEnabledClusters.find((x) => x.id === cluster.id)?.hasShadowdeskConfig;
  const shadowdeskEnabled = loginDesktopEnabledClusters.find((x) => x.id === cluster.id)?.shadowdeskEnabled;
  const hasShadowDesk = (hasShadowdeskConfig ? shadowdeskEnabled : publicConfig.SHADOW_DESK_ENABLED) || false;
  const shadowdeskAvailableWms = (hasShadowdeskConfig ? loginDesktopEnabledClusters.find(
    (x) => x.id === cluster.id)?.shadowdeskAvailableWms : publicConfig.SHADOW_DESK_WMS) || [];

  const { data, isLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {

      // List all desktop
      const { userDesktops } = await api.listDesktops({
        query: { cluster: cluster.id, loginNode: loginNode?.address },
      });
      return userDesktops.map(
        (userDesktop) => userDesktop.desktops.map(
          (x) => {
            const dataSource = x.type === "vnc" ? x.vnc : x.shadowdesk;
            return {
              desktopId: dataSource?.displayId || 0,
              desktopName: dataSource?.desktopName || "",
              createTime: dataSource?.createTime,
              addr: userDesktop.host,
              wm: dataSource?.wm || "",
              remoteControlTool: x.type === "shadowdesk" ? RemoteControlTool.SHADOWDESK : RemoteControlTool.VNC,
            } satisfies DesktopItem; },
        ),
      ).flat();
    }, [cluster, loginNode?.address]),
  });


  const { data: availableWms, isLoading: isWmLoading } = useAsync({
    promiseFn: useCallback(async () => api.listAvailableWms({ query: { cluster: cluster.id } }), [cluster.id]),
  });

  const columns: ColumnsType<DesktopItem> = [
    {
      title: t(p("tableItem.desktopName")),
      dataIndex: "desktopName",
      key: "desktopName",
      sorter:(a, b) => a.desktopName.localeCompare(b.desktopName),
    },
    {
      title: t(p("tableItem.wm")),
      dataIndex: "wm",
      key: "wm",
      width: "20%",
      render: (wm) => {
        return availableWms?.wms.find((x) => x.wm === wm)?.name || wm;
      },
      sorter:(a, b) => a.wm.localeCompare(b.wm),
    },
    ...(
      hasShadowDesk ? [{
        title: "远程控制工具",
        dataIndex: "remoteControlTool",
        key: "remoteControlTool",
        width: "18%",
        render: (remoteControlTool) => {
          return remoteControlTool === 0 ? "vnc" : "shadowdesk";
        },
      }] : []
    ),
    {
      title: t(p("tableItem.addr")),
      dataIndex: "addr",
      key: "addr",
      width: hasShadowDesk ? "16%" : "20%",
      render: (addr: string) => {
        return loginNodes[cluster.id].find((x) => x.address === addr)?.name || addr;
      },
      sorter:(a, b) => a.addr.localeCompare(b.addr),
    },
    {
      title: t(p("tableItem.createTime")),
      dataIndex: "createTime",
      key: "createTime",
      width: hasShadowDesk ? "12%" : "15%",
      render: (createTime) => {
        return createTime ? dayjs(createTime).format("YYYY-MM-DD[T]HH:mm:ss") : "";
      },
      sorter:(a, b) => Number(dayjs(a.createTime).isAfter(dayjs(b.createTime))),
    },
    {
      title: t("button.actionButton"),
      key: "action",
      width: hasShadowDesk ? "12%" : "15%",
      render: (_, record) => (
        <DesktopTableActions cluster={cluster} reload={reload} record={record} />
      ),
    },
  ];

  return (
    <div>
      <FilterFormContainer>
        <Form layout="inline">
          <Form.Item label={t(p("filterForm.cluster"))}>
            <SingleClusterSelector
              value={cluster}
              onChange={(x) => {
                router.push({ query: { cluster: x.id } });
              }}
              clusterIds={loginDesktopEnabledClusters.map((x) => x.id)}
            />
          </Form.Item>
          <Form.Item label={t(p("filterForm.loginNode"))}>
            <Select
              allowClear
              style={{ minWidth: 100 }}
              value={selectedLoginNodeAddress ?
                loginNodes[cluster.id].find((loginNode) => loginNode.address === selectedLoginNodeAddress)?.name : ""}
              onChange={(x) => {
                const nextLoginQuery = x
                  ? loginNodes[cluster.id].find((loginNode) => loginNode.address === x)?.address
                  : undefined;
                router.push({
                  query: nextLoginQuery
                    ? {
                      cluster: cluster.id,
                      loginNode: nextLoginQuery,
                    }
                    : { cluster: cluster.id },
                });
                setSelectedLoginNodeAddress(x);
              }}
              options={loginNodes[cluster.id].map((loginNode) => ({
                label: loginNode.name, value: loginNode.address,
              }))}
            >
            </Select>
          </Form.Item>
          <Form.Item>
            <Button onClick={reload} loading={isLoading}>
              {t("button.refreshButton")}
            </Button>
          </Form.Item>
          <Form.Item>
            <NewDesktopTableModalButton
              reload={reload}
              cluster={cluster}
              loginNodes={loginNodes[cluster.id]}
              availableWms={availableWms?.wms ?? []}
              shadowdeskAvailableWms={shadowdeskAvailableWms}
              hasShadowDesk={hasShadowDesk}
            >
              {t(p("filterForm.createNewDesktop"))}
            </NewDesktopTableModalButton>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => `${record.addr}:${record.desktopId}`}
        loading={isLoading || isWmLoading}
        pagination={false}
      />
    </div>
  );
};

