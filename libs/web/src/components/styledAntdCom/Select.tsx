import { Select, type SelectProps } from "antd";
import type { ComponentType } from "react";
import { styled } from "styled-components";

export const RoundedSelect: ComponentType<SelectProps> = styled(Select)`
  font-size: 14px !important;
  font-weight: lighter;
  box-shadow: "none";
  height: 42px !important;

  && .ant-select-selector {
    border-radius: 8px !important;
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
`;
