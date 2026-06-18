import type { ReactNode } from "react";

import { Avatar, Card, Space } from "antd";
import React from "react";
import { styled } from "styled-components";

import { SectionTitle } from "./TitledSectionCard";

export interface DualTitleCardProps {
  mainTitle: ReactNode;
  subTitle: ReactNode;
  logoSrc?: string;
  children?: ReactNode;
}

export const DualTitleCard = ({ mainTitle, subTitle, logoSrc, children }: DualTitleCardProps) => (
  <PaddedCard
    title={
      <HeaderRow align="center" size={16}>
        {logoSrc ? <HeaderAvatar size={32} src={logoSrc} /> : null}
        <HeaderTitle>{mainTitle}</HeaderTitle>
      </HeaderRow>
    }
  >
    <BorderlessCard title={<SectionTitle>{subTitle}</SectionTitle>}>{children}</BorderlessCard>
  </PaddedCard>
);

// 带主副标题的卡片，由两个antd 的Card组成
export const PaddedCard = styled(Card)`
  border: none !important;

  .ant-card-head {
    padding: 32px 56px 0 !important;
  }

  .ant-card-body {
    padding: 32px 56px 0 !important;
  }
`;

export const HeaderRow = styled(Space)`
  width: 100%;

  && {
    display: flex;
    align-items: center;
  }

  && .ant-space-item {
    display: flex;
    align-items: center;
  }
`;

export const HeaderAvatar = styled(Avatar)`
  background-color: rgba(240, 240, 240, 1) !important;
`;

export const HeaderTitle = styled.span`
  font-size: 16px;
  line-height: 24px;
`;

const StyledBorderlessCard = styled(Card)`
  border: none !important;

  .ant-card-head {
    min-height: 0 !important;
    padding: 0 !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 16px 0 0 0 !important;
  }
`;

const Divider = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.palette.gray[3]};
`;

export const BorderlessCard: React.FC<Omit<React.ComponentProps<typeof Card>, "ref"> & { $showDivider?: boolean }> = ({
  $showDivider,
  ...props
}) => (
  <>
    <StyledBorderlessCard {...props} />
    {$showDivider && <Divider />}
  </>
);
