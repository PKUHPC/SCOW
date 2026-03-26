import { Select, type SelectProps } from "antd";
import type { ComponentType } from "react";
import { styled } from "styled-components";

import { selectionArrowIcon } from "../../icons/commonIcons";
import { focusedBorderAndShadowStyle } from "./common";

const SelectionArrowIcon = selectionArrowIcon;

export const RoundedSelect: ComponentType<SelectProps> = styled(Select).attrs({
  suffixIcon: <SelectionArrowIcon style={{ pointerEvents: "none" }} />,
})`
  font-size: 14px !important;
  font-weight: lighter;
  height: 42px !important;
  box-shadow: none !important;

  && .ant-select-selector {
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05) !important;
    height: 42px !important;
    display: flex;
    align-items: center;
  }

  && .ant-select-selection-item {
    font-size: 14px !important;
    display: flex;
    align-items: center;
  }

  && .ant-select-selection-placeholder {
    font-size: 14px !important;
    color: rgba(136, 143, 163, 1) !important;
    display: flex;
    align-items: center;
  }

  ${focusedBorderAndShadowStyle}
`;
