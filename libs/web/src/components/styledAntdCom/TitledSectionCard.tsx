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
  border: 1px solid rgba(240, 240, 240, 1);
  border-radius: 8px;

  .ant-card-head {
    padding: 26px 36px 0 !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 16px 36px !important;
  }
`;

export const SectionTitle = styled(Typography.Text)`
  font-weight: 600;
  color: #434343;
`;
