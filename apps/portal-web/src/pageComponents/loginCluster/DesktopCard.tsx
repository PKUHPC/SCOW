import { App, Tooltip } from "antd";
import { join } from "path";
import React, { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DesktopCardIcon } from "src/icons/headerIcons/headerIcons";
import { DeleteIcon } from "src/icons/operationIcon";
import { DesktopItem, RemoteControlTool } from "src/pageComponents/loginCluster/DesktopCardList";
import {
  BaseCardInfoItem,
  CardActions,
  CardTitleContainer,
  StyledButton,
  StyledCard,
} from "src/utils/baseCardStyles";
import { getTransparentColor } from "src/utils/color";
import { publicConfig } from "src/utils/config";
import { openDesktop } from "src/utils/vnc";
import { styled, useTheme } from "styled-components";

const CardInfo = styled.div`
  margin-top: 12px;
  ${BaseCardInfoItem} {
    display: grid;
    grid-template-columns: var(--card-label-width, 120px) 1fr;
  }
`;

const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 27px;
`;

interface DesktopCardProps {
  data: DesktopItem;
  reload: () => void;
}

const p = prefix("pageComp.loginCluster.desktopCard.");

export const DesktopCard: React.FC<DesktopCardProps> = ({ data, reload }) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const isEnglish = languageId === "en";
  const { modal } = App.useApp();
  const theme = useTheme();
  const themeColor = theme.token.colorPrimary;
  const borderColorWithAlpha = getTransparentColor(themeColor, 0.15);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleLaunchDesktop = async () => {

    const extraProps = data.remoteControlTool === RemoteControlTool.SHADOWDESK ? {
      $case: "shadowdesk" as const,
      shadowdesk: {
        desktopName: data.desktopName,
      },
    } : {
      $case: "vnc" as const,
      vnc: {
        displayId: data.desktopId,
      },
    };

    const resp = await api.launchDesktop({
      body: {
        cluster: data.clusterId,
        loginNode: data.addr,
        displayId: data.desktopId,
        desktopInfo: { desktop: extraProps },
      },
    });

    if (resp.vnc) {
      openDesktop(data.clusterId, resp.vnc.host, resp.vnc.port, resp.vnc.password);
    } else {
      window.open(resp.shadowdesk?.shadowdeskUrl);
    }

  };

  const handleKillDesktop = async () => {
    const extraProps = data.remoteControlTool === RemoteControlTool.SHADOWDESK ? {
      $case: "shadowdesk" as const,
      shadowdesk: {
        desktopName: data.desktopName,
      },
    } : {
      $case: "vnc" as const,
      vnc: {
        displayId: data.desktopId,
      },
    };

    await api.killDesktop({
      body: {
        cluster: data.clusterId,
        loginNode: data.addr,
        displayId: data.desktopId,
        desktopInfo: { desktop: extraProps },
      },
    });

    reload();
  };

  const showDeleteConfirm = () => {
    modal.confirm({
      title: t(p("delete")),
      content: t(p("deleteConfirmContent")),
      onOk: handleKillDesktop,
    });
  };

  return (
    <StyledCard
      boxShadowColor={themeColor}
      title={(
        <CardTitleContainer>
          <AvatarContainer>
            {data.iconPath && !imageError ? (
              <img
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  objectFit: "contain",
                  width: "100%",
                  height: "100%",
                }}
                src={join(publicConfig.PUBLIC_PATH, data.iconPath)}
                onError={handleImageError}
              />
            ) : (
              <DesktopCardIcon styles={{ color: themeColor, width: "30px", height: "27px" }} />
            )}
          </AvatarContainer>
          <div>{data.title}</div>
        </CardTitleContainer>
      )}
      extra={(
        <Tooltip title={t("button.deleteButton")}>
          <StyledDeleteIcon
            onClick={showDeleteConfirm}
          />
        </Tooltip>
      )}
      style={{
        borderColor: borderColorWithAlpha,
        borderWidth: "1px",
      }}
    >
      <CardInfo style={{
        "--card-label-width": isEnglish ? "150px" : "120px",
      } as React.CSSProperties}
      >
        <BaseCardInfoItem>{t(p("clusterName"))}<span>{data.clusterName}</span></BaseCardInfoItem>
        <BaseCardInfoItem>{t(p("loginNode"))}<span>{data.loginNodeName}</span></BaseCardInfoItem>
        <BaseCardInfoItem>{t(p("desktopType"))}<span>{data.desktopType}</span></BaseCardInfoItem>
        <BaseCardInfoItem>{t(p("remoteControlTool"))}<span>{data.remoteTool}</span></BaseCardInfoItem>
        <BaseCardInfoItem>{t(p("createTime"))}<span>{data.creationTime}</span></BaseCardInfoItem>
      </CardInfo>
      <CardActions>
        <StyledButton type="default" onClick={handleLaunchDesktop}>
          {t(p("connect"))}
        </StyledButton>
      </CardActions>
    </StyledCard>
  );
};

const StyledDeleteIcon = styled(DeleteIcon)`
  color:  #888FA3;
  &:hover {
    color: ${(props) => props.theme.token.colorPrimary};
`;
