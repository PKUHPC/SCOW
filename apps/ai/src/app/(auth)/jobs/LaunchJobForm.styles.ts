import { Avatar, Segmented, Typography } from "antd";
import styled from "styled-components";

export const HeaderAvatar = styled(Avatar)`
  background-color: rgba(240, 240, 240, 1) !important;
`;

export const StyledPublicImageOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;

  .image-name {
    font-weight: 500;
    color: ${({ theme }) => theme.token.colorText};
  }

  .image-owner {
    color: rgba(136, 143, 163, 1);
    font-size: 13px;
  }
`;

export const ImageSelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const ImageSegmentedControl = styled(Segmented)`
  width: 100%;
  padding: 5px 8px !important;
  border-radius: 8px;
  color: ${({ theme }) => theme.palette.gray[6]} !important;
  margin-bottom: 6px !important;

  .ant-segmented-item-label {
    font-size: 14px !important;
    height: 32px !important;
    line-height: 32px !important;
    min-height: 32px !important;
  }

  .ant-segmented-item-selected {
    background: ${({ theme }) => theme.token.colorBgContainer};
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none;
  }
`;

export const ImageDescriptionBox = styled.div`
  min-height: 72px;
  padding: 16px 20px;
  border-radius: 8px;
  background: rgba(250, 250, 250, 1);
  color: rgba(136, 143, 163, 1);
  line-height: 1.6;

  table {
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid ${({ theme }) => theme.token.colorBorder};
    padding: 8px 12px;
  }

  pre {
    background-color: ${({ theme }) => theme.token.colorFillTertiary};
    border-radius: 4px;
    padding: 12px;
    overflow: auto;
  }

  code {
    background-color: ${({ theme }) => theme.token.colorFillTertiary};
    border-radius: 4px;
    padding: 2px 4px;
  }

  pre code {
    background-color: transparent;
    padding: 0;
  }
`;

export const AllocationLine = styled(Typography.Text)`
  display: block;
`;
