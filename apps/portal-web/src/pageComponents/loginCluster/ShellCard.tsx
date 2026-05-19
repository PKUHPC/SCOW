import { join } from "path";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ShellIcon } from "src/icons/headerIcons/headerIcons";
import { BaseCardInfoItem, CardActions, CardTitleContainer, StyledButton, StyledCard } from "src/utils/baseCardStyles";
import { getTransparentColor } from "src/utils/color";
import { publicConfig } from "src/utils/config";
import { styled, useTheme } from "styled-components";

const CardDescription = styled.p`
  margin-top: 10px;
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
}

interface ShellCardProps {
  data: ShellCardData;
}

const pCard = prefix("pageComp.loginCluster.shellCard.");

export const ShellCard: React.FC<ShellCardProps> = ({ data }) => {
  const t = useI18nTranslateToString();

  const theme = useTheme();
  const themeColor = theme.token.colorPrimary;
  const borderColorWithAlpha = getTransparentColor(themeColor, 0.15);

  const handleOpenShell = () => {
    const url = join(publicConfig.BASE_PATH, `/shell/${data.clusterId}/${data.nodeAddress}`);
    window.open(url, "_blank");
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
        {data.description.length > 0 ? data.description : t("pageComp.loginCluster.defaultDescription")}
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
