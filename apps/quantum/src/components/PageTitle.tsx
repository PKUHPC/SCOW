import { RefreshLink } from "@scow/lib-web/build/utils/refreshToken";
import { Typography } from "antd";
import React from "react";
import { useI18n } from "src/i18n";
import { styled } from "styled-components";

const Container = styled.div`
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

type PageTitleProps = React.PropsWithChildren<{
  beforeTitle?: React.ReactNode;
  titleText: React.ReactNode;
  isLoading?: boolean;
  reload?: () => void;
}>;

export const TitleText = styled(Typography.Title)`
  && {
    font-size: 20px;
  }
`;

export const PageTitle: React.FC<PageTitleProps> = ({
  beforeTitle, titleText, reload, children,
}) => {
  const languageId = useI18n().currentLanguage.id;
  return (
    <Container>
      <TitleText>
        {beforeTitle}
        {titleText}
      </TitleText>
      {children}
      { reload ? <RefreshLink refresh={reload} languageId={languageId} /> : undefined}
    </Container>
  );

};
