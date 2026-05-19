"use client";

import { Typography } from "antd";
import React from "react";
import styled from "styled-components";

const Container = styled.div`
  margin: 0 0 8px 0;
  display: flex;
  justify-content: space-between;
  h1 {
    margin-top: 0px;
  }
`;

type PageTitleProps = React.PropsWithChildren<{
  beforeTitle?: React.ReactNode;
  titleText: React.ReactNode;
  isLoading?: boolean;
  reload?: () => void;
}>;

export const TitleText = styled(Typography.Title)`
  && {
    font-size: 20px !important;
  }
`;

export const PageTitle: React.FC<PageTitleProps> = ({ beforeTitle, titleText, children }) => {
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
