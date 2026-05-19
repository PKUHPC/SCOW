import { TransferInfo } from "@scow/protos/build/portal/file";
import { App, Button, Progress, Table } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/utils/cluster";

interface TransferData {
  cluster: string;
  files: TransferInfo[];
}

const p = prefix("pageComp.fileManagerComp.transferInfoTable.");

export const TransferInfoTable: React.FC = () => {
  const { message, modal } = App.useApp();
  const t = useI18nTranslateToString();

  const [transferData, setTransferData] = useState<TransferData[]>();
  const [clusterList, setClusterList] = useState<Cluster[]>([]);

  const fetchClusterList = useCallback(async () => {
    const listClustersResponse = await api.listAvailableTransferClusters({ query: {} });
    return listClustersResponse.clusterList;
  }, []);

  const fetchTransferData = useCallback(async (clusters: Cluster[]) => {
    const newTransferData: TransferData[] = [];
    await Promise.all(
      clusters.map(async (cluster) => {
        const response = await api.queryFileTransferProgress({ query: { cluster: cluster.id } });
        newTransferData.push({
          cluster: cluster.id,
          files: response.result,
        });
      }),
    );
    return newTransferData;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeAndPoll = async () => {
      try {
        // 首次获取集群列表
        const clusters = await fetchClusterList();
        if (isMounted) {
          setClusterList(clusters);

          // 开始轮询传输数据
          const poll = async () => {
            if (!isMounted) return;

            try {
              const data = await fetchTransferData(clusters);
              if (isMounted) {
                setTransferData(data);
              }
            } catch (error) {
              console.error("Failed to fetch transfer data:", error);
            }

            // 只有在组件仍然挂载时才设置下一次轮询
            if (isMounted) {
              timeoutId = setTimeout(poll, 10000);
            }
          };

          poll();
        }
      } catch (error) {
        console.error("Failed to fetch cluster list:", error);
      }
    };

    initializeAndPoll();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchClusterList, fetchTransferData]);

  const columns = [
    {
      title: t(p("srcCluster")),
      dataIndex: "cluster",
      sorter: (a, b) => a.cluster.localeCompare(b.cluster),
    },
    {
      title: t(p("dstCluster")),
      dataIndex: "toCluster",
    },
    {
      title: t(p("file")),
      dataIndex: "filePath",
    },
    {
      title: t(p("transferCount")),
      dataIndex: "transferSizeKb",
      render: (transferSizeKb: number) => transferSizeKb + "KB",
    },
    {
      title: t(p("transferSpeed")),
      dataIndex: "speedKBps",
      render: (speedKBps: number) => speedKBps.toFixed(3) + "KB/s",
    },
    {
      title: t(p("timeLeft")),
      dataIndex: "remainingTimeSeconds",
      render: (remainingTimeSeconds: number) => remainingTimeSeconds + "s",
    },
    {
      title: t(p("currentProgress")),
      dataIndex: "progress",
      render: (progress: number) => <Progress percent={progress} />,
    },
    {
      title: t(p("operation")),
      dataIndex: "action",
      render: (_, row: TransferInfo & { cluster: string }) => (
        <Button
          type="link"
          onClick={() => {
            modal.confirm({
              title: t(p("confirmCancelTitle")),
              content: t(p("confirmCancelContent"), [row.cluster, row.toCluster, row.filePath]),
              okText: t(p("confirmOk")),
              onOk: async () => {
                await api
                  .terminateFileTransfer({
                    body: {
                      fromCluster: row.cluster,
                      toCluster: row.toCluster,
                      fromPath: row.filePath,
                    },
                  })
                  .then(() => {
                    message.success(t(p("cancelSuccess")));
                    fetchTransferData(clusterList).then((data) => setTransferData(data));
                  });
              },
            });
          }}
        >
          {t(p("cancel"))}
        </Button>
      ),
    },
  ];

  const getDataSource = (datas: TransferData[] | undefined) => {
    if (!datas) {
      return [];
    }
    return datas.flatMap((data) => data.files.map((file) => ({ ...file, cluster: data.cluster })));
  };

  return <Table dataSource={getDataSource(transferData)} columns={columns} pagination={false} />;
};
