import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { useI18nTranslateToString } from "src/i18n";
import { DesktopCard } from "src/pageComponents/loginCluster/DesktopCard";
import { NewDesktopCardModal } from "src/pageComponents/loginCluster/NewDesktopCardModal";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { styled } from "styled-components";

export enum RemoteControlTool {
  VNC = 0,
  SHADOWDESK = 1,
}

interface Cluster {
  id: string;
  name: string;
  description?: string;
}

const HeaderContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
`;

const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
`;

const StyledButton = styled(Button)`
  &.ant-btn {
    font-weight: 380;
  }
`;

interface APIDerivedDesktop {
  id: string;
  desktopId: number;
  desktopName: string;
  wm: string;
  createTime?: string;
  addr: string;
  remoteControlTool: RemoteControlTool;
  clusterId: string;
}

export interface DesktopItem extends APIDerivedDesktop {
  wmName: string;
  iconPath?: string;
  clusterName: string;
  loginNodeName: string;
  title: string;
  desktopType: string;
  remoteTool: "vnc" | "shadowdesk";
  creationTime: string;
}

interface DesktopCardListProps {
  clusters: Cluster[];
}

export const DesktopCardList: React.FC<DesktopCardListProps> = ({ clusters }) => {

  const t = useI18nTranslateToString();
  const [openNewDesktopModal, setOpenNewDesktopModal] = useState(false);
  const { loginNodes } = useStore(LoginNodeStore);

  // 获取所有集群的可用WM信息
  const { data: allAvailableWms, isLoading: isWmsLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const wmsPromises = clusters.map(async (cluster) => {
        try {
          const wmsData = await api.listAvailableWms({
            query: { cluster: cluster.id },
          });

          return {
            clusterId: cluster.id,
            wms: wmsData.wms,
          };
        } catch (error) {
          console.error(`Failed to get available wms for cluster ${cluster.id}:`, error);
          return {
            clusterId: cluster.id,
            wms: [],
          };
        }
      });

      const results = await Promise.all(wmsPromises);
      return results;
    }, [clusters]),
  });

  // 获取所有集群的listDesktops信息
  const { data: allDesktops, isLoading: isAllDesktopsLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {
      const desktopsPromises = clusters.map(async (cluster) => {
        try {
          // 不遍历loginNode，传空字符串
          const desktopData = await api.listDesktops({
            query: { cluster: cluster.id },
          });

          // 处理返回的数据，将其扁平化为DesktopItem数组
          const desktopItems = desktopData.userDesktops.map(
            (userDesktop) => userDesktop.desktops.map(
              (x) => {
                const dataSource = x.type === "vnc" ? x.vnc : x.shadowdesk;

                const item: APIDerivedDesktop = {
                  id: `${cluster.id}-${dataSource?.displayId}`,
                  desktopId: dataSource?.displayId || 0,
                  desktopName: dataSource?.desktopName || "",
                  createTime: dataSource?.createTime,
                  addr: userDesktop.host,
                  wm: dataSource?.wm || "",
                  remoteControlTool: x.type === "shadowdesk" ? RemoteControlTool.SHADOWDESK : RemoteControlTool.VNC,
                  clusterId: cluster.id,
                };

                return item;
              },
            ),
          ).flat();

          return {
            clusterId: cluster.id,
            desktops: desktopItems,
          };
        } catch (error) {
          console.error(`Failed to get desktops for cluster ${cluster.id}:`, error);
          return {
            clusterId: cluster.id,
            desktops: [],
          };
        }
      });

      const results = await Promise.all(desktopsPromises);
      return results;
    }, [clusters]),
  });

  const handleReload = () => {
    reload();
  };

  const handleCreateDesktop = () => {
    setOpenNewDesktopModal(true);
  };

  // 将所有集群的桌面数据合并为一个数组，并添加完整的信息用于展示
  const desktopData: DesktopItem[] = (allDesktops?.flatMap((item) => item.desktops) || [])
    .map((desktop) => {

      // 查找对应集群的WM信息
      const clusterWms = allAvailableWms?.find((wmsItem) => wmsItem.clusterId === desktop.clusterId)?.wms || [];

      // 查找集群名称
      const clusterName = clusters.find((c) => c.id === desktop.clusterId)!.name;

      // 查找登录节点名称
      const loginNodeInfo = loginNodes[desktop.clusterId]?.find((ln) => ln.address === desktop.addr);

      // 查找桌面类型
      const wmInfo = clusterWms.find((wm) => wm.wm === desktop.wm);
      const desktopType = wmInfo?.name || desktop.wm;

      // 远程控制工具名称
      const remoteTool = desktop.remoteControlTool === RemoteControlTool.SHADOWDESK ? "shadowdesk" : "vnc";

      // 创建时间格式化
      const creationTime = desktop.createTime
        ? dayjs(desktop.createTime).format("YYYY-MM-DD HH:mm:ss")
        : "";

      return {
        ...desktop,
        wmName: wmInfo?.name || desktop.wm,
        iconPath: wmInfo?.iconPath,
        clusterName,
        loginNodeName: loginNodeInfo?.name || desktop.addr,
        title: desktop.desktopName,
        desktopType,
        remoteTool,
        creationTime,
      } as DesktopItem;
    });

  return (
    <>
      <HeaderContainer>
        <StyledButton
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateDesktop}
          loading={isAllDesktopsLoading || isWmsLoading}
        >
          {t("pageComp.loginCluster.desktopCardList.newDesktop")}
        </StyledButton>
      </HeaderContainer>
      <CardContainer>
        {desktopData.map((item) => (
          <DesktopCard
            key={item.id}
            data={item}
            reload={handleReload}
          />
        ))}
      </CardContainer>
      <NewDesktopCardModal
        open={openNewDesktopModal}
        onClose={() => setOpenNewDesktopModal(false)}
        reload={handleReload}
        clusters={clusters}
        allAvailableWms={allAvailableWms || []}
        loginNodes={loginNodes}
      />
    </>
  );
};
