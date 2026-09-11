import React from "react";
import { css } from "styled-components";
import styled from "styled-components";

interface FileTableWrapperProps {
  /**
   * When true, the table body flex-fills all available height.
   * Use for panels/modals where height is determined by the container.
   * No need to pass scroll.y to the inner Table — this wrapper handles it via CSS.
   * Default false: Ant Design's scroll.y sets max-height on the body directly.
   */
  $fillHeight?: boolean;
  $inFileManager?: boolean; // 在 FileManager 页面下左侧无圆角
  style?: React.CSSProperties;
  className?: string;
}

export type FileIconComponent = React.ComponentType<{ style?: React.CSSProperties }>;

export const FileTableWrapper = styled.div<FileTableWrapperProps>`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden; // 确保内部滚动不穿透

  .ant-table-wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .ant-spin-nested-loading {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .ant-spin-nested-loading > .ant-spin {
    inset: 0;
    width: 100%;
    max-height: none;
    transform: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .ant-spin-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .ant-table {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* 外框由文件浏览器/选择框容器统一绘制，覆盖全局及 StyledTable 的内部边框和圆角。 */
  && .ant-table-wrapper,
  && .ant-table-wrapper .ant-table,
  && .ant-table-wrapper .ant-table-container,
  && .ant-table-wrapper .ant-table-content,
  && .ant-table-wrapper .ant-table-header,
  && .ant-table-wrapper .ant-table-body {
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  && .ant-table-wrapper .ant-table-container {
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left: none !important;
  }

  && .ant-table-thead > tr > th:first-child,
  && .ant-table-thead > tr > th:last-child,
  && .ant-table-thead > tr > td:first-child,
  && .ant-table-thead > tr > td:last-child {
    border-radius: 0 !important;
  }

  .ant-table-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: visible;

    /* 干掉 antd 默认边框（所有来源） */
    border: none !important;
    box-shadow: none !important;
  }

  /* 干掉 antd 用伪元素画的左侧竖线 */
  .ant-table-wrapper .ant-table-container::before,
  .ant-table-wrapper .ant-table-container::after {
    display: none !important;
  }

  .ant-table-header {
    flex-shrink: 0;
    position: sticky; // 固定表头
    top: 0;
    z-index: 10;
    /* 表头去掉竖线（列之间的分割线） */
    .ant-table-cell {
      &::before {
        display: none !important; /* antd 表头竖线是用 ::before 伪元素画的 */
      }
    }
  }

  .ant-table-selection-column,
  .ant-table-selection-col {
    width: 56px !important;
    min-width: 56px !important;
    max-width: 56px !important;
    box-sizing: border-box;
    padding-left: 24px !important;
    padding-right: 16px !important;
  }

  colgroup > col.ant-table-selection-col + col,
  colgroup:not(:has(> col.ant-table-selection-col)) > col:first-child {
    width: 42px !important;
    min-width: 42px !important;
    max-width: 42px !important;
  }

  /* 排除选择列和第一列 */
  .ant-table-thead > tr > th:not(.ant-table-selection-column):not(:nth-child(1)),
  .ant-table-tbody > tr > td:not(.ant-table-selection-column):not(:nth-child(1)) {
    padding-left: 24px !important;
    padding-right: 24px !important;
  }

  /* 文件类型列与选择框之间保留 16px，图标右侧保留 24px */
  .ant-table-thead > tr > th.ant-table-cell.file-type-column,
  .ant-table-tbody > tr > td.ant-table-cell.file-type-column {
    width: 42px !important;
    min-width: 42px !important;
    max-width: 42px !important;
    box-sizing: border-box;
    padding-left: 0 !important;
    padding-right: 24px !important;
  }

  .ant-table-tbody > tr > td.ant-table-cell.file-type-column > div,
  .ant-table-tbody > tr > td.ant-table-cell.file-type-column > span,
  .ant-table-tbody > tr > td.ant-table-cell.file-type-column .anticon {
    position: relative;
    width: 18px !important;
    height: 18px !important;
    max-width: 18px !important;
    max-height: 18px !important;
    transform: none !important;
  }

  .ant-table-tbody > tr > td.ant-table-cell.file-type-column svg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 32px !important;
    height: 32px !important;
    max-width: none !important;
    max-height: none !important;
    transform: translate(-50%, -50%) !important;
  }

  .ant-table-thead > tr > th {
    height: 56px !important;
    min-height: 56px !important;
    padding-top: 16px !important;
    padding-bottom: 16px !important;
    font-size: 14px !important;
    line-height: 22px !important;
  }

  .ant-table-thead > tr {
    height: 56px !important;
  }

  .ant-table-tbody > tr:not(.ant-table-measure-row) {
    height: 50px !important;
  }

  .ant-table-tbody > tr:not(.ant-table-measure-row) > td.ant-table-cell {
    box-sizing: border-box;
    height: 50px !important;
    min-height: 50px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    font-size: 14px !important;
    line-height: 22px !important;
  }

  .ant-table-tbody > tr > td.ant-table-cell:not(.ant-table-selection-column):not(.file-type-column) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Ant Design 用于计算列宽的隐藏行不能被表体 padding 撑开 */
  .ant-table-tbody > tr.ant-table-measure-row > td.ant-table-cell {
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }

  .ant-table-body,
  .ant-table-content {
    position: relative;
    box-sizing: border-box;
    ${({ $fillHeight }) =>
      $fillHeight
        ? css`
            flex: 1 !important;
            min-height: 0 !important;
            height: 0 !important;
            max-height: none !important;
          `
        : ""}
    overflow: auto !important;
    overflow-x: hidden !important;
    scrollbar-gutter: auto;

    /* 单表结构下固定表头 */
    thead.ant-table-thead {
      position: sticky;
      top: 0;
      z-index: 10;
      background: ${({ theme }) => theme.token.colorBgContainer};
    }

    /* 细滚动条 */
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.token.colorBorderSecondary};
      border-radius: 4px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: ${({ theme }) => theme.token.colorBorder};
    }
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.token.colorBorderSecondary} transparent;
  }

  ${({ $fillHeight }) =>
    $fillHeight
      ? css`
          .ant-table-body,
          .ant-table-content {
            overflow-x: auto !important;
          }

          .ant-table:not(.ant-table-empty) .ant-table-body > table,
          .ant-table:not(.ant-table-empty) .ant-table-content > table {
            height: auto !important;
            min-height: 0 !important;
          }

          .ant-table:not(.ant-table-empty) .ant-table-tbody {
            height: auto !important;
          }
        `
      : ""}

  /* 每行之间加横线 */
  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${({ theme }) => theme.token.colorBorderSecondary} !important;
  }

  /* 表头与内容区之间的分隔线 */
  .ant-table-thead > tr > th {
    border-bottom-color: ${({ theme }) => theme.palette.gray[4]} !important;
  }

  /* 数据行颜色 */
  .ant-table-tbody .ant-table-cell,
  .ant-table-tbody .ant-table-cell a,
  .ant-table-tbody .ant-table-cell .ant-btn {
    color: ${({ theme }) => theme.palette.gray[8]};
  }

  /* Empty state */
  .ant-table.ant-table-empty .ant-table-body > table,
  .ant-table.ant-table-empty .ant-table-content > table {
    min-height: 100%;
  }
  .ant-table.ant-table-empty .ant-table-measure-row {
    display: none !important;
  }
  .ant-table.ant-table-empty .ant-table-placeholder > td {
    height: 100% !important;
    vertical-align: middle;
    border-bottom: none !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  /* 选中行 hover */
  .ant-table-tbody > tr.ant-table-row-selected > td.ant-table-cell-row-hover {
    background-color: ${({ theme }) => theme.token.colorPrimaryBg} !important;
    color: ${({ theme }) => theme.token.colorTextHeading} !important;
  }

  /* FileManager 模式 */
  ${({ $inFileManager }) =>
    $inFileManager &&
    css`
      .ant-table-thead > tr > th:first-child,
      .ant-table-thead > tr > td:first-child {
        border-start-start-radius: 0 !important;
      }
    `}
`;

export const EllipsisNameWrapper = styled.div`
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  /* 强制覆盖 Ant Design 的 Button 和 a 标签的行为 */
  a,
  button,
  .ant-btn {
    max-width: 100%;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    vertical-align: bottom;
    display: inline-block; /* 确保 max-width 生效 */
  }

  /* 针对 Antd Button 内部真正装文字的 span */
  .ant-btn > span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
  }
`;
