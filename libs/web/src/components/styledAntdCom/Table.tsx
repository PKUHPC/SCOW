import type { ComponentType, ReactNode } from "react";

import { Table, type TableProps } from "antd";
import { styled } from "styled-components";

import { doubleCircleForTableIcon } from "../../icons/commonIcons";

type StyledTableComponent = ComponentType<TableProps<any>>;
const DoubleCircleForTableIcon = doubleCircleForTableIcon;

const defaultRadioSelectionCell = (
  checked: boolean,
  _record: unknown,
  _index: number,
  originNode: ReactNode,
) => {
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

const TableWrapper = ({
  className,
  rowSelection,
  ...tableProps
}: TableProps<any> & { className?: string }) => {
  const mergedRowSelection: TableProps<any>["rowSelection"] =
    rowSelection?.type === "radio"
      ? {
          ...rowSelection,
          renderCell: rowSelection.renderCell ?? defaultRadioSelectionCell,
        }
      : rowSelection;

  return <Table {...tableProps} className={className} rowSelection={mergedRowSelection} />;
};

export const StyledTable: StyledTableComponent = styled(TableWrapper)<TableProps<any>>`
  .ant-table-container {
    border-radius: 12px;
    border-top: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-right: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-bottom: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-left: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    overflow: hidden;
    box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
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
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.palette.gray[3]};
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);

  .ant-table {
    border-radius: 0;
  }

  .ant-table-container {
    border-radius: 0;
    border: none !important;
  }

  .ant-table-thead > tr > th {
    background-color: ${({ theme }) => theme.palette.gray[0]};
    border-bottom: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    color: ${({ theme }) => theme.palette.gray[7]};
    height: 56px;
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
    height: 56px;
    padding-top: 0;
    padding-bottom: 0;
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
