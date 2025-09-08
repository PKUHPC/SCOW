import { styled } from "styled-components";

export const TableWrapper = styled.div`
  /* dataSource 为空时，antd 会自动在最外层加 .ant-table-empty */
  .ant-table-empty .ant-table-content {
    overflow-x: hidden !important;
  }
`;
