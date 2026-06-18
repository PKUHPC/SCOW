import type { ReactNode } from "react";

import { Card, Typography } from "antd";
import React from "react";
import { styled } from "styled-components";

export interface TitledSectionCardProps {
  title: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
}

export const TitledSectionCard = ({ title, children, style }: TitledSectionCardProps) => (
  <SectionCard style={style} title={<SectionTitle>{title}</SectionTitle>}>
    {children}
  </SectionCard>
);

// 内容区的卡片
const StyledSectionCard = styled(Card)`
  border: none;

  .ant-card-head {
    padding: 24px 56px 0 !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 16px 56px 8px 56px !important;
  }
`;

const SectionDivider = styled.div`
  margin: 0 56px;
  border-bottom: 1px solid ${({ theme }) => theme.palette.gray[3]};
`;

export const SectionCard: React.FC<Omit<React.ComponentProps<typeof Card>, "ref"> & { $showDivider?: boolean }> = ({
  $showDivider = true,
  ...props
}) => (
  <>
    <StyledSectionCard {...props} />
    {$showDivider && <SectionDivider />}
  </>
);

export const SectionTitle = styled(Typography.Text)`
  font-weight: 600;
  color: ${({ theme }) => theme.palette.gray[8]};
`;
