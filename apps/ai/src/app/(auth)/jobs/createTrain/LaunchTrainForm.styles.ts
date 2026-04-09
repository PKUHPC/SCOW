import { Segmented, Space } from "antd";
import styled from "styled-components";

export const FrameworkSegmentedControl = styled(Segmented)`
  && {
    max-width: 520px;
  }

  padding: 5px 14px !important;
  border-radius: 8px;
  color: ${({ theme }) => theme.palette.gray[6]} !important;
  margin-bottom: 6px !important;

  .ant-segmented-item-label {
    font-size: 14px !important;
  }

  .ant-segmented-item-selected {
    background: ${({ theme }) => theme.token.colorBgContainer};
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none;
  }
`;

export const InlineAddonInputGroup = styled(Space.Compact)`
  width: 100%;
  max-width: 520px;
  height: 42px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;

  /* 错误态时由外层统一绘制红色边框，避免内外双重圆角 */
  .ant-form-item-has-error & {
    border-color: ${({ theme }) => theme.token.colorError};
    box-shadow: 0 2 2 0 ${({ theme }) => theme.token.colorErrorBorder};
  }

  && .ant-space-compact-item {
    height: 100%;
  }

  .addon-label {
    display: flex;
    align-items: center;
    height: 100%;
    flex: 0 0 160px;
    padding: 0 14px;
    font-size: 14px;
    color: rgba(136, 143, 163, 1);
    background: ${({ theme }) => theme.token.colorBgContainer};
    border-right: 1px solid ${({ theme }) => theme.palette.gray[4]};
  }

  .addon-input {
    flex: 1;
    height: 100%;
    border-color: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }

  .addon-input:not(.ant-input-number-status-error):hover,
  .addon-input:not(.ant-input-number-status-error):focus,
  .addon-input:not(.ant-input-number-status-error).ant-input-number-focused {
    border-color: transparent;
    box-shadow: none;
  }

  .addon-input.ant-input-number-status-error {
    border-color: transparent !important;
    box-shadow: none !important;
  }

  .addon-input.ant-input-number-disabled {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    background-color: ${({ theme }) => theme.palette.gray[1]} !important;
  }

  .addon-input .ant-input-number-input {
    height: 100%;
    padding: 0 12px;
  }
`;
