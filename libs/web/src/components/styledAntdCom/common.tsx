import { css } from "styled-components";

export const focusedBorderAndShadowStyle = css`
  &:focus,
  &:focus-within,
  &.ant-input-focused,
  &.ant-input-affix-wrapper-focused,
  &.ant-input-number-focused,
  .ant-input:focus,
  .ant-input-focused,
  .ant-input-affix-wrapper:focus,
  .ant-input-affix-wrapper:focus-within,
  .ant-input-affix-wrapper-focused,
  .ant-input-number:focus,
  .ant-input-number:focus-within,
  .ant-input-number-focused,
  &.ant-input-number-group-wrapper .ant-input-number:focus,
  &.ant-input-number-group-wrapper .ant-input-number:focus-within,
  &.ant-input-number-group-wrapper .ant-input-number-focused,
  &.ant-select-focused .ant-select-selector,
  &.ant-select-open .ant-select-selector,
  .ant-select-focused .ant-select-selector,
  .ant-select-open .ant-select-selector,
  .ant-select-selector:focus,
  .ant-select-selector:focus-within {
    border-color: ${({ theme }) => theme.palette.primary[6]} !important;
    box-shadow: none !important;
  }
`;
