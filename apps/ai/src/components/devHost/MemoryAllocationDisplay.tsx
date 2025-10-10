"use client";

import { GlobalToken, Progress, Typography } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
const { Text } = Typography;

interface MemoryAllocationDisplayProps {
  allocatedMemory: number;
  totalMemory: number;
  token: GlobalToken;
  showContainer?: boolean;
}

export const MemoryAllocationDisplay: React.FC<MemoryAllocationDisplayProps> = ({
  allocatedMemory,
  totalMemory,
  token,
  showContainer = false,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.createPage.");

  const content = (
    <>
      <Text strong>{showContainer ? t(p("memoryAllocation")) : "内存分配:"}</Text>
      <div style={{ marginTop: showContainer ? 8 : 4 }}>
        <Text>
          <span>{showContainer ? t(p("allocatedMemory")) : "将分配内存"}: </span>
          <span style={{ color: token.colorPrimary, fontWeight: "bold" }}>
            {Math.round(allocatedMemory)} MB
          </span>
        </Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary">
          {showContainer ? t(p("totalMemory")) : "分区总内存"}: {totalMemory} MB
        </Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Progress
          percent={Math.round((allocatedMemory / totalMemory) * 100)}
          size="small"
          showInfo={false}
        />
      </div>
    </>
  );

  if (showContainer) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "6px",
          background: token.colorBgContainer,
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {content}
    </div>
  );
};
