"use client";

import { styled } from "styled-components";

/** Ant Design v5 展开图标列的默认宽度，子表格整体向内偏移此宽度 */
export const EXPANDED_TABLE_MARGIN_LEFT = 39;

export const ExpandedTableContainer = styled.div`
  display: block;

  .ant-table-wrapper {
    margin-left: ${EXPANDED_TABLE_MARGIN_LEFT}px;
    width: calc(100% - ${EXPANDED_TABLE_MARGIN_LEFT}px);
  }

  .ant-table,
  .ant-table-container,
  .ant-table-content {
    border-radius: 0 !important;
  }

  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td {
    border-radius: 0 !important;
  }

  .ant-table-thead > tr > th:first-child,
  .ant-table-tbody > tr > td:first-child {
    padding-left: 16px;
    text-align: left;
  }

  &::after {
    content: "";
    display: block;
    height: 40px;
    margin-left: ${EXPANDED_TABLE_MARGIN_LEFT}px;
    width: calc(100% - ${EXPANDED_TABLE_MARGIN_LEFT}px);
    box-sizing: border-box;
    border-right: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
    border-bottom: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
    border-left: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
    background: ${({ theme }) => theme.token.colorFillAlter};
  }
`;
