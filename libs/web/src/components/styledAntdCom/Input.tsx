import { Input, InputNumber, type InputNumberProps, Select, type SelectProps } from "antd";
import type { ComponentType } from "react";
import { css, styled } from "styled-components";

import { selectionArrowIcon } from "../../icons/commonIcons";
import { focusedBorderAndShadowStyle } from "./common";
import { TrimInput } from "./TrimInput";

const commonInputStyles = css`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 8px;
  flex: 1;
  width: 100%;
  height: 42px;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);

  &,
  .ant-input-affix-wrapper {
    border-radius: 8px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
  }

  ${focusedBorderAndShadowStyle}

  .ant-input {
    border: none !important;
    box-shadow: none !important;
  }

  .ant-input::placeholder, &::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }
`;

export const RoundedInput = styled(TrimInput)`
  ${commonInputStyles}
`;

export const RoundedSearch = styled(Input.Search)`
  ${commonInputStyles}

  .ant-input-outlined::placeholder, &::placeholder {
    color: #BFBFBF !important;
    font-weight: 300;
  }
  .ant-input-search-button {
    width: 60px;
    background: ${({ theme }) => theme.token.colorBgContainer};
    border-left: 2px solid ${({ theme }) => theme.palette.gray[3]};
    &:hover {
      background: none !important;
    }
    &:active {
      background: none !important;
    }
    .ant-btn-icon {
      color: ${({ theme }) => theme.palette.primary[6]}
    }
  }
`;

export const RoundedPasswordInput = styled(Input.Password)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 8px;
  flex: 1;
  width: 100%;
  height: 42px;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);

  .ant-input {
    border-radius: 8px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]};
  }

  .ant-input::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }

  ${focusedBorderAndShadowStyle}
`;

export const RoundedInputNumber: ComponentType<InputNumberProps> = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  flex: 1;
  height: 42px;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);

  &,
  .ant-input-number {
    border-radius: 8px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
  }

  .ant-input-number-input {
    height: 42px;
  }

  .ant-input-number-input::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }

  ${focusedBorderAndShadowStyle}
`;

export const RoundedInputNumberWithAddonAfter: ComponentType<InputNumberProps> = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  flex: 1;
  height: 42px;
  box-shadow: none !important;

  .ant-input {
    border-radius: 8px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]};
  }

  &.ant-input-number-group-wrapper .ant-input-number {
    height: 42px;
    border-radius: 8px 0 0 8px;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
  }

  .ant-input-number-input::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }

  &.ant-input-number-group-wrapper {
    border-radius: 8px;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group {
    width: 100%;
    table-layout: fixed;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group-addon {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    white-space: nowrap;
  }

  &.ant-input-number-group-wrapper .ant-input-number {
    width: 100% !important;
    border-right: none !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-input-wrap {
    padding-right: 8px;
  }

  &.ant-input-number-group-wrapper .ant-select-selector {
    border-left: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    border-radius: 0 8px 8px 0 !important;
    box-shadow: none !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group-addon .ant-select {
    height: 42px;
    margin: 0 !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group-addon .ant-select-selector {
    height: 42px !important;
    border-color: ${({ theme }) => theme.palette.gray[3]} !important;
    display: flex;
    align-items: center;
    margin: 0 !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number,
  &.ant-input-number-group-wrapper .ant-input-number-focused,
  &.ant-input-number-group-wrapper .ant-input-number:focus,
  &.ant-input-number-group-wrapper .ant-input-number:focus-within {
    box-shadow: none !important;
  }

  &.ant-input-number-group-wrapper .ant-select-focused .ant-select-selector,
  &.ant-input-number-group-wrapper .ant-select-open .ant-select-selector,
  &.ant-input-number-group-wrapper .ant-select-selector:focus,
  &.ant-input-number-group-wrapper .ant-select-selector:focus-within {
    border-color: ${({ theme }) => theme.palette.primary[6]} !important;
    border-left-color: ${({ theme }) => theme.palette.primary[6]} !important;
    box-shadow: none !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-focused + .ant-input-number-group-addon .ant-select-selector,
  &.ant-input-number-group-wrapper .ant-input-number:focus-within + .ant-input-number-group-addon .ant-select-selector {
    border-left-color: ${({ theme }) => theme.palette.primary[6]} !important;
  }

  ${focusedBorderAndShadowStyle}
`;

const SelectionArrowIcon = selectionArrowIcon;

export const AddonAfterSelect: ComponentType<SelectProps> = styled(Select).attrs({
  suffixIcon: <SelectionArrowIcon style={{ pointerEvents: "none" }} />,
})`
  font-size: 14px !important;
  font-weight: lighter;
  height: 42px !important;
  box-shadow: none !important;

  && .ant-select-selector {
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    border-radius: 0 8px 8px 0 !important;
    border-left-width: 1px !important;
    height: 42px !important;
    padding: 0 10px !important;
    display: flex;
    align-items: center;
  }

  && .ant-select-arrow {
    right: 10px !important;
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
