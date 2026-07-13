import { join } from "path";
import { ShellIcon } from "src/assets/headerIcons";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { BaseCardInfoItem, CardActions, CardTitleContainer, StyledButton, StyledCard } from "src/utils/baseCardStyles";
import { getTransparentColor } from "src/utils/color";
import { styled, useTheme } from "styled-components";

const CardDescription = styled.p`
  color: rgba(0, 0, 0, 0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-weight: 330;
  line-height: 24px;
  font-size: 14px;
  color: rgba(136, 143, 163, 1);
  margin-top: -12px;
`;

const CardInfo = styled.div`
  margin-top: 12px;
  ${BaseCardInfoItem} {
    display: grid;
    grid-template-columns: 90px 1fr;
  }
`;

export interface ShellCardData {
  id: string;
  description: string;
  clusterName: string;
  clusterId: string;
  nodeAddress: string;
  nodeName: string;
  shellBaseUrl: string;
  shellType: "portal" | "ai";
}

interface ShellCardProps {
  data: ShellCardData;
}

const pCard = prefix("pageComp.admin.shellCard.");

export const ShellCard: React.FC<ShellCardProps> = ({ data }) => {
  const t = useI18nTranslateToString();

  const theme = useTheme();
  const themeColor = theme.token.colorPrimary;
  const borderColorWithAlpha = getTransparentColor(themeColor, 0.15);

  const handleOpenShell = () => {
    const shellPath =
      data.shellType === "portal"
        ? `/shell/${data.clusterId}/${data.nodeAddress}?useRoot=true`
        : `/shell/${data.clusterId}/${data.nodeAddress}`;
    const fullUrl = join(data.shellBaseUrl, shellPath);
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <StyledCard
      $boxShadowColor={themeColor}
      title={
        <CardTitleContainer>
          <ShellIcon styles={{ color: themeColor, width: "30px", height: "27px" }} />
          <div>Shell</div>
        </CardTitleContainer>
      }
      style={{
        borderColor: borderColorWithAlpha,
        borderWidth: "1px",
      }}
    >
      <CardDescription>
        {data.description.length > 0 ? data.description : t(pCard("defaultDescription"))}
      </CardDescription>
      <CardInfo>
        <BaseCardInfoItem>
          {t(pCard("clusterName"))}
          <span>{data.clusterName}</span>
        </BaseCardInfoItem>
        <BaseCardInfoItem>
          {t(pCard("loginNode"))}
          <span>{data.nodeName}</span>
        </BaseCardInfoItem>
      </CardInfo>

      <CardActions>
        <StyledButton type="default" onClick={handleOpenShell}>
          {t(pCard("open"))}
        </StyledButton>
      </CardActions>
    </StyledCard>
  );
};
