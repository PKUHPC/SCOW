/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

"use client";
import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`

  @font-face {
    font-family: 'MiSans';
    src: url('/libs/web/fonts/MiSans-Medium.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
  }

  @font-face {
    font-family: 'MiSans';
    src: url('/libs/web/fonts/MiSans-Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
  }

  :root {
    font-family: 'MiSans', system-ui;
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

  .head-language-select .ant-select-item {
    color: #434343 !important;
  }

  .head-language-select .ant-select-item:not(.ant-select-item-option-selected):hover {
      color: #595959 !important;
  }

  .head-language-select .ant-select-item-option-selected{
      background-color: transparent !important;
      color: ${({ theme }) => theme.token.colorPrimary} !important;
      font-weight: unset !important;
  }

  .head-language-select .ant-select-item-option-selected:hover {
    background-color: #59595914 !important;
  }

  .head-navigation-user-indicator .ant-dropdown-menu-item {
    color: #434343 !important
  }

  .head-navigation-user-indicator .ant-dropdown-menu-item:hover {
    color: #595959 !important
  }

  .head-system-select .ant-dropdown-menu-item{
    padding: 0 !important;
  }
`;

