"use client";
import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
  }

  #nprogress .bar {
    background-color: ${({ theme }) => theme.token.colorPrimary};
  }

 // HACK
  a {
    color: ${({ theme }) => theme.token.colorPrimaryText};
  }

 // 对日期组件在手机端展示做样式兼容处理(起)
  .ant-picker-dropdown {
    max-width: 100%;
  }

  .ant-picker-dropdown .ant-picker-panel-layout {
    overflow-y: scroll;
  }
 // 对日期组件在手机端展示做样式兼容处理(止)

 //  对表格组件样式统一处理
  .ant-table-wrapper .ant-table-thead >tr>th, .ant-table-wrapper .ant-table-thead >tr>td {
    white-space: nowrap;
  }
`;
