import { Button } from "antd";
import { styled } from "styled-components";

export const RoundedButton = styled(Button)<{
  $selected?: boolean;
  $width?: string;
  $height?: string;
}>`
  width: ${({ $width }) => $width ?? "110px"};
  height: ${({ $height }) => $height ?? "44px"};
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  background: ${({ theme }) => theme.token.colorBgContainer} !important;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  color: rgba(136, 143, 163, 1) !important;

  ${({ $selected, theme }) => $selected && `
    border-color: ${theme.token.colorPrimary} !important;
    color: ${theme.token.colorPrimary} !important;
    box-shadow: none !important;
  `}

  &:disabled {
    opacity: .5;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    cursor: not-allowed;
  }
`;
