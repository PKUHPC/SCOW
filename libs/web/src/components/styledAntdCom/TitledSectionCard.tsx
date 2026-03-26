import { Card, Typography } from "antd";
import type { ReactNode } from "react";
import { styled } from "styled-components";

export interface TitledSectionCardProps {
  title: ReactNode;
  children?: ReactNode;
}

export const TitledSectionCard = ({
  title,
  children,
}: TitledSectionCardProps) => (
  <SectionCard title={<SectionTitle>{title}</SectionTitle>}>
    {children}
  </SectionCard>
);

// 内容区的卡片
export const SectionCard = styled(Card)`
  border: 1px solid ${({ theme }) => theme.palette.gray[3]};
  border-radius: 8px;

  .ant-card-head {
    padding: 24px 24px 0 !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 24px !important;
  }
`;

export const SectionTitle = styled(Typography.Text)`
  font-weight: 600;
  color: ${({ theme }) => theme.palette.gray[8]};
`;
