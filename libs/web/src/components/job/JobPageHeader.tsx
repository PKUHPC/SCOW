import type { ReactNode } from "react";

import { Button, Divider } from "antd";
import { styled } from "styled-components";

import { SingleBackIcon } from "../../icons/commonIcons";

interface Props {
  title: ReactNode;
  action?: ReactNode;
  backLabel?: ReactNode;
  logo?: ReactNode;
  onBack?: () => void;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 12px;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const Title = styled.span`
  min-width: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 380;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BackButton = styled(Button)`
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px;
  height: 24px;
  padding: 0 !important;
  font-size: 20px !important;
  line-height: 24px;

  .anticon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    height: 24px;
    line-height: 0;
  }

  svg {
    display: block;
  }
`;

const BackLabel = styled.span`
  display: inline-flex;
  align-items: center;
  height: 24px;
  font-weight: 380;
  line-height: 24px;
`;

const Action = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;

  .ant-btn {
    width: 76px;
    height: 36px;
  }
`;

export const JobPageHeader = ({ title, action, backLabel, logo, onBack }: Props) => {
  const showBack = backLabel !== undefined && onBack !== undefined;

  return (
    <Container>
      <Group>
        {showBack ? (
          <>
            <BackButton type="link" onClick={onBack}>
              <SingleBackIcon />
              <BackLabel>{backLabel}</BackLabel>
            </BackButton>
            <Divider type="vertical" style={{ height: 20, margin: 0 }} />
          </>
        ) : null}
        <Group>
          {logo}
          <Title>{title}</Title>
        </Group>
      </Group>
      {action ? <Action>{action}</Action> : null}
    </Container>
  );
};
