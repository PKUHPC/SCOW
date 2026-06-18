import type { TextAreaProps } from "antd/es/input";
import type { SearchProps } from "antd/es/input/Search";
import type { ComponentType } from "react";

import { Input, InputNumber, type InputNumberProps, Select, type SelectProps } from "antd";
import { css, styled } from "styled-components";

import { selectionArrowIcon } from "../../icons/commonIcons";
import { focusedBorderAndShadowStyle } from "./common";
import { TrimInput } from "./TrimInput";

const commonInputStyles = css`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 4px;
  box-sizing: border-box !important;
  flex: 1;
  width: 100%;
  height: 36px;
  padding: 6px 16px !important;
  box-shadow: none !important;

  &,
  .ant-input-affix-wrapper {
    border-radius: 4px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    padding: 6px 16px !important;
  }

  ${focusedBorderAndShadowStyle}

  .ant-input {
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  .ant-input::placeholder,
  &::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1 !important;
  }

  &:disabled,
  &.ant-input-disabled,
  .ant-input-affix-wrapper-disabled,
  .ant-input-affix-wrapper-disabled .ant-input {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    background-color: ${({ theme }) => theme.palette.gray[1]} !important;
  }
`;

export const RoundedInput = styled(TrimInput)`
  ${commonInputStyles}
`;

export interface RoundedSearchOwnProps {
  $height?: string;
}

export type RoundedSearchProps = SearchProps & RoundedSearchOwnProps;

export const RoundedSearch: ComponentType<RoundedSearchProps> = styled(Input.Search)<RoundedSearchOwnProps>`
  ${commonInputStyles}

  &.ant-input-search {
    padding: 0 !important;
    height: auto;
  }

  .ant-input-wrapper .ant-input {
    height: ${({ $height }) => $height ?? "36px"};
    padding: 6px 16px !important;
  }

  .ant-input-outlined::placeholder,
  &::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    font-size: 14px;
    font-weight: 300;
  }
  .ant-input-search-button {
    width: 60px;
    height: ${({ $height }) => $height ?? "36px"};
    background: ${({ theme }) => theme.token.colorBgContainer};
    border-left: 1px solid ${({ theme }) => theme.palette.gray[4]};
    &:hover {
      background: none !important;
    }
    &:active {
      background: none !important;
    }
    .ant-btn-icon {
      color: ${({ theme }) => theme.palette.primary[6]};
    }
  }
`;

export const RoundedTextArea: ComponentType<TextAreaProps> = styled(Input.TextArea)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 4px !important;
  width: 100%;
  min-height: 54px;
  padding: 6px 16px !important;
  box-shadow: none !important;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;

  ${focusedBorderAndShadowStyle}

  &::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1 !important;
  }

  &:disabled,
  &.ant-input-disabled {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    background-color: ${({ theme }) => theme.palette.gray[1]} !important;
  }
`;

export const RoundedPasswordInput = styled(Input.Password)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 4px;
  flex: 1;
  width: 100%;
  height: 36px;
  box-sizing: border-box !important;
  box-shadow: none !important;

  .ant-input {
    border-radius: 4px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]};
    padding: 6px 16px !important;
  }

  .ant-input::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1 !important;
  }

  ${focusedBorderAndShadowStyle}
`;

export const RoundedInputNumber: ComponentType<InputNumberProps> = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  flex: 1;
  height: 36px;
  box-sizing: border-box !important;
  box-shadow: none !important;

  &,
  .ant-input-number {
    box-sizing: border-box !important;
    border-radius: 4px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
  }

  .ant-input-number-input {
    height: 34px !important;
    box-sizing: border-box !important;
    padding: 6px 16px !important;
  }

  .ant-input-number-input::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1 !important;
  }

  ${focusedBorderAndShadowStyle}
`;

export const RoundedInputNumberWithAddonAfter: ComponentType<InputNumberProps> = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  flex: 1;
  height: 36px;
  box-shadow: none !important;

  .ant-input {
    border-radius: 4px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  }

  &.ant-input-number-group-wrapper .ant-input-number {
    height: 36px !important;
    box-sizing: border-box !important;
    border-radius: 4px 0 0 4px;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-input {
    height: 34px !important;
    box-sizing: border-box !important;
    padding: 6px 16px !important;
  }

  .ant-input-number-input::placeholder {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1 !important;
  }

  &.ant-input-number-group-wrapper {
    border-radius: 4px;
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
    border-left: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-radius: 0 4px 4px 0 !important;
    box-shadow: none !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group-addon .ant-select {
    height: 36px;
    margin: 0 !important;
  }

  &.ant-input-number-group-wrapper .ant-input-number-group-addon .ant-select-selector {
    height: 36px !important;
    border-color: ${({ theme }) => theme.palette.gray[4]} !important;
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
  height: 36px !important;
  box-shadow: none !important;

  && .ant-select-selector {
    box-sizing: border-box !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-radius: 0 4px 4px 0 !important;
    border-left-width: 1px !important;
    height: 36px !important;
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
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    display: flex;
    align-items: center;
  }

  ${focusedBorderAndShadowStyle}
`;
