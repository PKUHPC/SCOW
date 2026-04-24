import { styled } from "styled-components";

export const PublicAssetTableContainer = styled.div`
  .public-asset-list-table .ant-table-tbody > tr > td {
    padding: 8px 16px;
    height: 56px;
  }

  .public-asset-list-table
    > .ant-spin-nested-loading
    > .ant-spin-container
    > .ant-table
    > .ant-table-container
    > .ant-table-content
    > table
    > .ant-table-thead
    > tr
    > th:nth-child(2),
  .public-asset-list-table
    > .ant-spin-nested-loading
    > .ant-spin-container
    > .ant-table
    > .ant-table-container
    > .ant-table-content
    > table
    > .ant-table-tbody
    > tr:not(.ant-table-expanded-row)
    > td:nth-child(2) {
    padding-left: 6px;
    text-align: left;
  }

  .ant-table-expanded-row > td.ant-table-cell {
    padding: 0 !important;
  }
`;
