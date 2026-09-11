import type { ComponentType, ReactNode } from "react";

import { Table, type TableProps } from "antd";
import { styled } from "styled-components";

import { doubleCircleForTableIcon } from "../../icons/commonIcons";

type StyledTableComponent = ComponentType<TableProps<any>>;
const DoubleCircleForTableIcon = doubleCircleForTableIcon;

const defaultRadioSelectionCell = (checked: boolean, _record: unknown, _index: number, originNode: ReactNode) => {
  if (!checked) {
    return originNode;
  }
  return (
    <span
      className="scow-table-radio-selected-icon"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <DoubleCircleForTableIcon style={{ fontSize: 18 }} />
    </span>
  );
};

const TableWrapper = ({ className, rowSelection, ...tableProps }: TableProps<any> & { className?: string }) => {
  const mergedRowSelection: TableProps<any>["rowSelection"] =
    rowSelection?.type === "radio"
      ? {
          ...rowSelection,
          renderCell: rowSelection.renderCell ?? defaultRadioSelectionCell,
        }
      : rowSelection;

  return <Table {...tableProps} className={className} rowSelection={mergedRowSelection} />;
};
const StyledTableWrapper = ({ scroll, ...tableProps }: TableProps<any>) => (
  <TableWrapper {...tableProps} scroll={scroll ? { ...scroll, x: scroll.x ?? "max-content" } : undefined} />
);

export const StyledTable: StyledTableComponent = styled(StyledTableWrapper)<TableProps<any>>`
  .ant-table-container {
    border-radius: 4px;
    border-top: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-right: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-bottom: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-left: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    overflow: hidden;
    box-shadow: none !important;
  }

  .ant-table-tbody > tr > td {
    height: 65px;
    padding-top: 12px;
    padding-bottom: 12px;
    color: ${({ theme }) => theme.palette.gray[6]};
  }

  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td {
    border-inline-end: none !important;
  }

  .ant-table-tbody > tr > td {
    border-bottom: none !important;
  }

  .ant-table-thead > tr > th {
    background-color: ${({ theme }) => theme.palette.gray[1]};
  }

  tr.selected-row td {
    background-color: ${({ theme }) => theme.token.colorPrimaryBg} !important;
    color: ${({ theme }) => theme.token.colorTextHeading} !important;
  }

  .ant-table-container:has(.ant-table-tbody > tr.selected-row:last-child) {
    box-shadow: inset 0 -4px 0 ${({ theme }) => theme.token.colorPrimaryBg} !important;
  }

  .ant-table-content::-webkit-scrollbar-track {
    background-color: ${({ theme }) => theme.token.colorBgContainer};
  }

  .ant-table-tbody > tr.selected-row:last-child > td:first-child {
    border-bottom-left-radius: 4px !important;
  }

  .ant-table-tbody > tr.selected-row:last-child > td:last-child {
    border-bottom-right-radius: 4px !important;
  }

  tr.disabled-row td {
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    background-color: ${({ theme }) => theme.token.colorFillQuaternary} !important;
    opacity: 0.8;
  }

  tr.disabled-row:hover td {
    background-color: ${({ theme }) => theme.token.colorFillQuaternary} !important;
  }

  tr.disabled-row .ant-typography {
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
  }

  .scow-table-radio-selected-icon {
    color: ${({ theme }) => theme.token.colorPrimary};
  }

  .ant-table-selection-column {
    width: 56px !important;
    min-width: 56px !important;
  }
`;

export const TableWithSplitLines: StyledTableComponent = styled(TableWrapper)<TableProps<any>>`
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.palette.gray[3]};
  box-shadow: none !important;

  .ant-table {
    border-radius: 0;
  }

  .ant-table table {
    table-layout: fixed !important;
  }

  .ant-table-container {
    border-radius: 0;
    border: none !important;
  }

  .ant-table-thead > tr > th {
    background-color: ${({ theme }) => theme.palette.gray[0]};
    border-bottom: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    color: ${({ theme }) => theme.palette.gray[7]};
    height: 36px;
    padding-top: 0;
    padding-bottom: 0;
  }

  .ant-table-thead > tr > th::before {
    display: none !important;
  }

  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td {
    border-inline-end: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
  }

  .ant-table-thead > tr > th:last-child,
  .ant-table-tbody > tr > td:last-child {
    border-inline-end: none !important;
  }

  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    color: ${({ theme }) => theme.palette.gray[7]};
    min-height: 36px;
    padding: 6px 8px;
    word-break: break-all;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .ant-table-tbody > tr > td:first-child {
    color: ${({ theme }) => theme.palette.gray[6]};
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none !important;
  }

  .ant-table-tbody > tr:hover > td {
    background-color: ${({ theme }) => theme.palette.gray[1]} !important;
  }
`;

/**
 * 文件管理及文件选择框使用的表格样式。
 *
 * 文件列表只需要统一外框颜色和行分隔线，不能继承 TableWithSplitLines 的列分隔线，
 * 否则每个文件属性单元格都会出现纵向框线。这里继续基于通用 StyledTable，兼容其
 * 后续的选中态、横向滚动等改动，同时保持文件列表原有的无纵向分隔线设计。
 */
export const ConsistentBorderTable: StyledTableComponent = styled(StyledTable)<TableProps<any>>`
  .ant-table,
  .ant-table-container,
  .ant-table-container table > thead > tr > th,
  .ant-table-container table > tbody > tr > td,
  .ant-table-thead > tr > th::before {
    border-color: ${({ theme }) => theme.token.colorBorderSecondary} !important;
  }

  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${({ theme }) => theme.token.colorBorderSecondary} !important;
  }

  .ant-table-thead > tr > th {
    border-bottom-color: ${({ theme }) => theme.palette.gray[4]} !important;
  }
`;
