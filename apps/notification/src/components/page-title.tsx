import { Typography } from "antd";
import React from "react";
import { styled } from "styled-components";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

type PageTitleProps = React.PropsWithChildren<{
  beforeTitle?: React.ReactNode;
  titleText: React.ReactNode;
  isLoading?: boolean;
}>;

export const TitleText = styled(Typography.Title)`
  margin: 0 !important;
  && {
    font-size: 20px !important;
  }
`;

export const PageTitle: React.FC<PageTitleProps> = ({ beforeTitle, titleText, children }) => {
  // const languageId = useI18n().currentLanguage.id;
  return (
    <Container>
      <TitleText>
        {beforeTitle}
        {titleText}
      </TitleText>
      {children}
    </Container>
  );
};
