import { Table, type TableProps } from "antd";
import type { ComponentType, ReactNode } from "react";
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

const TableWrapper = ({ className, rowSelection, ...tableProps }: TableProps<any> & { className?: string }) => {
  const mergedRowSelection: TableProps<any>["rowSelection"] = rowSelection?.type === "radio"
    ? {
      ...rowSelection,
      renderCell: rowSelection.renderCell ?? defaultRadioSelectionCell,
    }
    : rowSelection;

  return (
    <Table
      {...tableProps}
      className={className}
      rowSelection={mergedRowSelection}
    />
  );
};

export const StyledTable: StyledTableComponent = styled(TableWrapper)<TableProps<any>>`
  .ant-table-container {
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]};
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
`;
