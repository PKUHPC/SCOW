import { Space } from "antd";
import { styled } from "styled-components";

export const JobContainer = styled(Space)`
  margin-bottom: 30px;
  display: flex !important;
  flex-direction: column;
  width: 100%;
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.token.colorBgContainer};
`;

export const JobPageLayout = styled.div`
  display: flex;
  align-items: flex-start;
`;

export const JobMainContent = styled.div`
  flex: 1;
  min-width: 0;
`;

export const JobSidePanel = styled.div`
  width: 25%;
  min-width: 320px;
  font-size: 13px;
  flex-shrink: 0;
  background: ${({ theme }) => theme.token.colorBgContainer};
  align-self: stretch;
`;

export const JobSidePanelInner = styled.div`
  position: sticky;
  top: 0;
  padding: 32px;
  padding-left: 10px;
  padding-bottom: 64px;
  max-height: calc(100vh - 78px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const JobSidePanelScrollBox = styled.div`
  background: ${({ theme }) => theme.palette.gray[2]};
  border-radius: 4px;
  padding: 24px 32px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

export const JobSidePanelInfoBox = styled.div`
  background: ${({ theme }) => theme.palette.gray[2]};
  border-radius: 4px;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
`;

export const SidePanelRow = styled.div`
  display: flex;
  align-items: center;
`;

export const SidePanelLabel = styled.span`
  width: 100px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.palette.gray[8]};
`;

export const SidePanelValue = styled.span`
  margin-left: 24px;
  font-weight: 500;
  color: ${({ theme }) => theme.token.colorPrimary};
`;
