import { Button, Card, Tag, Typography } from "antd";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DisplayedDeviceState, getDisplayedStateI18nTexts } from "src/models/device";
import { formatTimestamp } from "src/utils/datetime";
import styled from "styled-components";

interface Props {
  id: string;
  path: string;
  name: string;
  description: string;
  status?: DisplayedDeviceState;
  updateTime?: number;
  gateFidelity?: string;
}

const { Text } = Typography;

const DeviceCardWrapper = styled(Card)`
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  position: relative;
  box-shadow: #0000000d 0px 4px 4px 0px;
  .ant-card-body {
    padding: 0 !important;
  }
`;

const ImageWrapper = styled.div`
  width: 100%;
  height: 140px;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover; // 使用 cover 模式保持比例
    object-position: center; // 图片居中显示
  }
`;

const InfoSection = styled.div`
  padding: 16px;
  padding-bottom: 32px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const NameText = styled(Text)`
  font-size: 16px;
`;

const DetailsButton = styled(Button)`
  position: absolute;
  bottom: 13px;
  right: 16px;
`;

const StatusTag = styled(Tag)`
  margin: 0 !important;
`;

// 将高清图路径转换为低清图路径
const getLowResPath = (highResPath: string): string => {
  return highResPath.replace(/\.png$/, "_low.jpg");
};

export default function DeviceCard({ id, path, name, description, status, updateTime, gateFidelity }: Props) {
  const router = useRouter();
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.device.deviceCard.");
  const statusColor = status === DisplayedDeviceState.DISPLAYED_ONLINE ? "green" : "red";
  const DisplayedStateI18nTexts = getDisplayedStateI18nTexts(t);

  const formatTime = updateTime ? formatTimestamp(updateTime) : undefined;

  const handleDetailsClick = () => {
    router.push(`/chip/${id}/detail`);
  };

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const lowResPath = getLowResPath(path); // 生成低清图的路径

  useEffect(() => {
    const image = new Image();
    image.src = path;
    image.onload = () => {
      setIsImageLoaded(true);
    };
    return () => {
      image.onload = null;
    };
  }, [path]);

  return (
    <DeviceCardWrapper>
      <ImageWrapper>
        <img
          src={isImageLoaded ? path : lowResPath} // 加载完成后显示高清图，否则显示低清图
          alt="Device"
        />
      </ImageWrapper>

      <InfoSection>
        <Header>
          <NameText>{name}</NameText>
          {status !== undefined && <StatusTag color={statusColor}>{DisplayedStateI18nTexts[status]}</StatusTag>}
        </Header>
        <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
          {description}
        </Text>
        {gateFidelity && id !== "simulator:tc" && (
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {gateFidelity}
          </Text>
        )}
        {updateTime && (
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {t(p("updateTime"))}: {formatTime}
          </Text>
        )}
      </InfoSection>
      {id !== "simulator:tc" && (
        <DetailsButton type="primary" size="small" onClick={handleDetailsClick}>
          {t(p("viewDetail"))}
        </DetailsButton>
      )}
    </DeviceCardWrapper>
  );
}
