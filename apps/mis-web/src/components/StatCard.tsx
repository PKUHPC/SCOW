import { Card } from "antd";
import React from "react";
import { styled } from "styled-components";

type Props = React.PropsWithChildren<{
  title: React.ReactNode;
  icon?: React.ReactNode;
}>;

const Title = styled.h3`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChildrenContainer = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  flex: 1;
`;

const Header = styled.header`
  display: flex;
  justify-content: flex-start;
  align-items: baseline;
`;

const IconContainer = styled.div`
  flex-shrink: 0;
  margin-left: clamp(1em, 12%, 5em);
`;

export const AccountStatCard: React.FC<Props> = ({ children, title, icon }) => {
  return (
    <Card
      style={{ height: "100%" }}
      styles={{
        body: { display: "flex", flexDirection: "column", height: "100%" },
      }}
    >
      <Header>
        <Title>{title}</Title>
        <IconContainer>{icon}</IconContainer>
      </Header>
      <ChildrenContainer>{children}</ChildrenContainer>
    </Card>
  );
};
