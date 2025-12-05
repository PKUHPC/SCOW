"use client";

import { Card, Col, GlobalToken, Progress, Row, Typography } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

const { Title, Text } = Typography;

export interface Partition {
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
  totalMemMb: number;
  allocMemMb: number;
  gpuModel?: string;
  acceleratorDescriptions: string[];
}

interface ResourceCardProps {
  partition: Partition;
  isSelected: boolean;
  onSelect: (partition: Partition) => void;
  token: GlobalToken;
}

const StyledResourceCard = styled(Card)<{ $token: GlobalToken }>`
  margin-bottom: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    border-color: ${(props) => props.$token.colorPrimary};
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  }

  &.selected {
    border-color: ${(props) => props.$token.colorPrimary};
    box-shadow: none;
  }
`;

export const ResourceCard: React.FC<ResourceCardProps> = ({
  partition,
  isSelected,
  onSelect,
  token,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.createPage.");

  const cpuUsagePercent = partition.cpuCoreCount > 0
    ? Math.round((partition.runningCpuCount / partition.cpuCoreCount) * 100)
    : 0;
  const gpuUsagePercent = partition.gpuCoreCount > 0
    ? Math.round((partition.runningGpuCount / partition.gpuCoreCount) * 100)
    : 0;

  // 计算内存使用率
  const memoryUsagePercent = partition.totalMemMb > 0
    ? Math.round((partition.allocMemMb / partition.totalMemMb) * 100)
    : 0;


  return (
    <StyledResourceCard
      className={isSelected ? "selected" : ""}
      onClick={() => onSelect(partition)}
      $token={token}
    >
      <div>
        {/* 标题行 */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={5} style={{ margin: 0, fontSize: "14px" }}>{partition.partitionName}</Title>
          </Col>
          <Col>
            <div style={{ textAlign: "right" }}>
              {partition.acceleratorDescriptions.map((item) => (
                <Text type="secondary" style={{ fontSize: "12px", display: "block" }}>
                  {item}
                </Text>
              ))}
            </div>
          </Col>
        </Row>

        {/* 资源使用情况 */}
        <Row gutter={[16, 8]}>
          <Col span={8}>
            <Text strong>{t(p("cpuCores"))}</Text>
            <div>
              <Text>{partition.idleCpuCount} / {partition.cpuCoreCount}</Text>
              <Progress
                percent={cpuUsagePercent}
                size="small"
                showInfo={false}
                strokeColor={cpuUsagePercent >= 100 ? "#E45B39" : "#6AB9B6"}
              />
            </div>
          </Col>
          {partition.gpuCoreCount > 0 && (
            <Col span={8}>
              <Row gutter={[16, 8]}>
                <Text strong>{t(p("acceleratorCard"))}</Text>
                {partition.gpuModel && (
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      {partition.gpuModel}
                    </Text>
                  </Col>
                )}
              </Row>
              <div>
                <Text>{partition.idleGpuCount} / {partition.gpuCoreCount}</Text>
                <Progress
                  percent={gpuUsagePercent}
                  size="small"
                  showInfo={false}
                  strokeColor={gpuUsagePercent >= 100 ? "#E45B39" : "#6AB9B6"}
                />
              </div>
            </Col>
          )}
          {partition.totalMemMb !== undefined && partition.allocMemMb !== undefined && (
            <Col span={8}>
              <Text strong>{t(p("memory"))}</Text>
              <div>
                <Text>
                  {Math.round((partition.totalMemMb - partition.allocMemMb) / 1024)}GB
                  / {Math.round(partition.totalMemMb / 1024)}GB
                </Text>
                <Progress
                  percent={memoryUsagePercent}
                  size="small"
                  showInfo={false}
                  strokeColor={memoryUsagePercent >= 100 ? "#E45B39" : "#6AB9B6"}
                />
              </div>
            </Col>
          )}
        </Row>
      </div>
    </StyledResourceCard>
  );
};
