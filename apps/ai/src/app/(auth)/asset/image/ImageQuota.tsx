import { Divider } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

export const Container = styled.div`
  padding: 0px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;
`;

interface Props {
  usedGiB: number | string;
  totalGiB: number | string;
}

export const ImageQuota: React.FC<Props> = ({ usedGiB,totalGiB }) => {

  const t = useI18nTranslateToString();
  const p = prefix("app.image.imageQuota.");

  return (
    <Container>
      {t(p("quota"))}：{totalGiB} GB
      <Divider type="vertical" />
      {t(p("usedQuota"))}：{usedGiB} GB
    </Container>
  );
};
