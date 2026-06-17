import { PlusOutlined } from "@ant-design/icons";
import { AvailableWm } from "@scow/protos/build/portal/desktop";
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
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
  gap: 24px;
`;

const StyledButton = styled(Button)`
  &.ant-btn {
    font-weight: 380;
  }
`;

interface APIDerivedDesktop {
  id?: number;
  desktopId: number;
  desktopName: string;
  wm: string;
  iconPath?: string;
  createTime?: string;
  addr: string;
  remoteControlTool: RemoteControlTool;
  clusterId: string;
  isActive?: boolean;
}

export interface DesktopItem extends APIDerivedDesktop {
  id: number;
  isActive?: boolean;
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

interface WmsItem {
  clusterId: string;
  wms: AvailableWm[];
}

export const DesktopCardList: React.FC<DesktopCardListProps> = ({
  clusters,
}) => {
  const t = useI18nTranslateToString();
  const [openNewDesktopModal, setOpenNewDesktopModal] = useState(false);
  const [allAvailableWms, setAllAvailableWms] = useState<WmsItem[]>([]);
  const [isWmsLoading, setIsWmsLoading] = useState(false);
  const { loginNodes } = useStore(LoginNodeStore);

  // 获取所有集群的listDesktops信息
  const {
    data: allDesktops,
    isLoading: isAllDesktopsLoading,
    reload,
  } = useAsync({
    promiseFn: useCallback(async () => {
      try {
        // loginNodes 传空，返回所有loginNode的desktop
        const desktopData = await api.listDesktops({
          body: {
            clusters: clusters.map((cluster) => ({
              cluster: cluster.id,
              loginNodes: [],
            })),
          },
        });

        return desktopData.results.map(({ clusterId, userDesktops }) => {
          const desktopItems = (userDesktops ?? [])
            .map((userDesktop) =>
              userDesktop.desktops.map((x) => {
                const dataSource = x.data;

                const item: APIDerivedDesktop = {
                  id: dataSource?.id,
                  isActive: dataSource?.isActive,
                  desktopId: dataSource?.displayId || 0,
                  desktopName: dataSource?.desktopName || "",
                  iconPath: dataSource?.iconPath,
                  createTime: dataSource?.createTime,
                  addr: userDesktop.host,
                  wm: dataSource?.wm || "",
                  remoteControlTool:
                    x.type === "shadowdesk"
                      ? RemoteControlTool.SHADOWDESK
                      : RemoteControlTool.VNC,
                  clusterId,
                };

                return item;
              })
            )
            .flat();

          return {
            clusterId,
            desktops: desktopItems,
          };
        });
      } catch (error) {
        console.error("Failed to get desktops:", error);
        return clusters.map((cluster) => {
          return {
            clusterId: cluster.id,
            desktops: [],
          };
        });
      }
    }, [clusters]),
  });

  const handleReload = () => {
    reload();
  };

  const handleCreateDesktop = async () => {
    setIsWmsLoading(true);
    try {
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
          console.error(
            `Failed to get available wms for cluster ${cluster.id}:`,
            error
          );
          return {
            clusterId: cluster.id,
            wms: [],
          };
        }
      });

      setAllAvailableWms(await Promise.all(wmsPromises));
      setOpenNewDesktopModal(true);
    } finally {
      setIsWmsLoading(false);
    }
  };

  // 将所有集群的桌面数据合并为一个数组，并添加完整的信息用于展示
  const desktopData: DesktopItem[] = (
    allDesktops?.flatMap((item) => item.desktops) || []
  ).map((desktop) => {
    // 查找集群名称
    const clusterName = clusters.find((c) => c.id === desktop.clusterId)!.name;

    // 查找登录节点名称
    const loginNodeInfo = loginNodes[desktop.clusterId]?.find(
      (ln) => ln.address === desktop.addr
    );

    // 远程控制工具名称
    const remoteTool =
      desktop.remoteControlTool === RemoteControlTool.SHADOWDESK
        ? "shadowdesk"
        : "vnc";

    // 创建时间格式化
    const creationTime = desktop.createTime
      ? dayjs(desktop.createTime).format("YYYY-MM-DD HH:mm:ss")
      : "";

    return {
      ...desktop,
      clusterName,
      loginNodeName: loginNodeInfo?.name || desktop.addr,
      title: desktop.desktopName,
      desktopType: desktop.wm,
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
            key={item.id || `${item.clusterId}-${item.desktopId}`}
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
        allAvailableWms={allAvailableWms}
        loginNodes={loginNodes}
      />
    </>
  );
};
