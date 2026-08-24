import { Button, ConfigProvider, type ButtonProps } from "antd";
import { forwardRef } from "react";
import { styled } from "styled-components";

const WaveDisabledButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <ConfigProvider wave={{ disabled: true }}>
    <Button {...props} ref={ref} />
  </ConfigProvider>
));

WaveDisabledButton.displayName = "WaveDisabledButton";

export interface RoundedButtonOwnProps {
  $selected?: boolean;
  $width?: string;
  $height?: string;
  $color?: string;
}

// 完整 Props 类型 = Ant Design ButtonProps + RoundedButton 专属 Props
export type RoundedButtonProps = ButtonProps & RoundedButtonOwnProps;

export const RoundedButton = styled(WaveDisabledButton)<RoundedButtonOwnProps>`
  ${({ $width }) => ($width ? `width: ${$width};` : "")}
  height: ${({ $height }) => $height ?? "36px"} !important;
  font-size: 14px !important;
  font-weight: 300;
  line-height: 22px;
  padding: 0px 16px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer} !important;
  box-shadow: none !important;
  color: ${({ $color, theme }) => $color ?? theme.palette.gray[8]} !important;

  &:not(:disabled):hover {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none !important;
  }

  ${({ $selected, theme }) =>
    $selected &&
    `
    border-color: ${theme.token.colorPrimary} !important;
    color: ${theme.token.colorPrimary} !important;
    box-shadow: none !important;
  `}

  &:disabled {
    opacity: 0.9;
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    cursor: not-allowed;
  }
`;

export const RoundedSmallButton = styled(WaveDisabledButton)<{
  $selected?: boolean;
  $width?: string;
  $height?: string;
}>`
  ${({ $width }) => ($width ? `width: ${$width};` : "")}
  height: ${({ $height }) => $height ?? "28px"};
  font-size: 14px;
  line-height: 22px;
  padding: 7px 12px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer} !important;
  box-shadow: none !important;
  color: ${({ theme }) => theme.palette.gray[6]} !important;

  &:not(:disabled):hover {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none !important;
  }

  ${({ $selected, theme }) =>
    $selected &&
    `
    border-color: ${theme.token.colorPrimary} !important;
    color: ${theme.token.colorPrimary} !important;
    box-shadow: none !important;
  `}

  &:disabled {
    opacity: 0.5;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    cursor: not-allowed;
  }
`;

export const AntdButton = styled(WaveDisabledButton)`
  border-radius: 4px;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
`;
