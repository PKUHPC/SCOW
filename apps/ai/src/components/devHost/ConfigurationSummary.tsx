"use client";

import { Card, Col, Row, theme, Typography } from "antd";
import { ImageType } from "src/app/(auth)/devHost/CreateDevHostForm";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ImageSource } from "src/models/Job";
import { styled } from "styled-components";

const { Title, Text } = Typography;

interface Partition {
  partitionName: string;
  nodeCount: number;
  runningNodeCount: number;
  idleNodeCount: number;
  notAvailableNodeCount?: number;
  cpuCoreCount: number;
  runningCpuCount: number;
  idleCpuCount: number;
  notAvailableCpuCount?: number;
  gpuCoreCount: number;
  runningGpuCount: number;
  idleGpuCount: number;
  notAvailableGpuCount?: number;
  jobCount: number;
  runningJobCount: number;
  pendingJobCount: number;
  usageRatePercentage: number;
}

interface ConfigurationSummaryProps {
  selectedCluster?: string;
  selectedAccount?: string;
  selectedPartition?: Partition;
  clusters: { id: string; name: string }[];
  imageSource: ImageSource;
  selectedImage?: { type?: ImageType; name?: number };
  selectedRemoteImageUrl?: string;
  baseImageConfig?: string[];
  publicConfig: any;
}

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  .ant-card-body {
    padding: 16px;
  }
`;

export const ConfigurationSummary: React.FC<ConfigurationSummaryProps> = ({
  selectedCluster,
  selectedAccount,
  selectedPartition,
  clusters,
}) => {
  const { token } = theme.useToken();

  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.createPage.");

  const selectedClusterName = clusters.find((c) => c.id === selectedCluster)?.name;

  return (
    <StyledCard style={{ marginBottom: 16, backgroundColor: token.colorFillAlter }}>
      <Title level={4} style={{ fontSize: "18px", fontWeight: 500 }}>{t(p("configurationSummary"))}</Title>
      <Row gutter={[16, 8]}>
        <Col span={6}>
          <Text strong>{t(p("cluster"))}:</Text>
          <div>{selectedClusterName || "-"}</div>
        </Col>
        <Col span={6}>
          <Text strong>{t(p("account"))}:</Text>
          <div>{selectedAccount || "-"}</div>
        </Col>
        <Col span={6}>
          <Text strong>{t(p("partition"))}:</Text>
          <div>{selectedPartition?.partitionName || "-"}</div>
        </Col>
        <Col span={6}>
          <Text strong>{t(p("availableResources"))}:</Text>
          <div>
            {selectedPartition && (
              <>
                CPU: {selectedPartition.idleCpuCount}/{selectedPartition.cpuCoreCount}
                {selectedPartition.gpuCoreCount > 0 && (
                  <>, {t(p("acceleratorCard"))}: {selectedPartition.idleGpuCount}/{selectedPartition.gpuCoreCount}</>
                )}
              </>
            )}
          </div>
        </Col>
      </Row>
    </StyledCard>
  );
};
