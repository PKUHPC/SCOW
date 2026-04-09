import type { ComponentType } from "react";

import { Select, type SelectProps } from "antd";
import { useRef } from "react";
import { styled } from "styled-components";

import { selectionArrowIcon } from "../../icons/commonIcons";
import { focusedBorderAndShadowStyle } from "./common";

const SelectionArrowIcon = selectionArrowIcon;

const SelectContainer = ({ className, ...props }: SelectProps & { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={className}>
      <Select
        {...props}
        suffixIcon={<SelectionArrowIcon style={{ pointerEvents: "none" }} />}
        dropdownAlign={{ offset: [0, 8] }}
        getPopupContainer={() => ref.current ?? document.body}
      />
    </div>
  );
};

export const RoundedSelect: ComponentType<SelectProps> = styled(SelectContainer)`
  position: relative;

  .ant-select {
    font-size: 14px !important;
    font-weight: lighter;
    height: 42px !important;
    box-shadow: none !important;
    width: 100%;
  }

  .ant-select-selector {
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05) !important;
    height: 42px !important;
    display: flex;
    align-items: center;
  }

  .ant-select-selection-item {
    font-size: 14px !important;
    display: flex;
    align-items: center;
  }

  .ant-select-selection-placeholder {
    font-size: 14px !important;
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    display: flex;
    align-items: center;
  }

  .ant-select-disabled .ant-select-selector {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    background-color: ${({ theme }) => theme.palette.gray[1]} !important;
  }

  ${focusedBorderAndShadowStyle}

  .ant-select-item-option-selected {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    background-color: transparent !important;
  }

  .ant-select-item-option-selected.ant-select-item-option-active {
    background-color: ${({ theme }) => theme.token.controlItemBgHover} !important;
  }
`;
