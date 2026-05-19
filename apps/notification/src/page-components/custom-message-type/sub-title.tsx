import React, { PropsWithChildren } from "react";
import styled from "styled-components";

interface Props {
  title: string;
}

const SubTitleContainer = styled.div`
  display: flex;
  align-items: center;
  height: 20px;
  margin: 30px 0;
`;

const Indicator = styled.div`
  width: 12px;
  height: 100%;
  background: #94070a;
`;

const TitleText = styled.div`
  font-size: 16px;
  margin-left: 5px;
`;

export const SubTitle: React.FC<PropsWithChildren<Props>> = ({ children, title }) => {
  return (
    <SubTitleContainer>
      <Indicator />
      <TitleText>{title}</TitleText>
      {children}
    </SubTitleContainer>
  );
};
