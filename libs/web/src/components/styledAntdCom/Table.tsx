import { Table, TableProps } from "antd";
import type { ComponentType } from "react";
import { styled } from "styled-components";

type StyledTableComponent = ComponentType<TableProps<any>>;

export const StyledTable: StyledTableComponent = styled(Table)<TableProps<any>>`
  .ant-table-tbody > tr > td {
    height: 65px;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td {
    border-inline-end: none !important;
  }

  tr.selected-row td {
    background-color: ${({ theme }) => theme.token.colorPrimaryBg} !important;
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
`;
