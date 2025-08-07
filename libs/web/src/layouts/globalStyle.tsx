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
  :root {
    font-family: 'MiSans', system-ui;
  }

  #nprogress .bar {
    background-color: ${({ theme }) => theme.token.colorPrimary};
  }

  h1 {
    font-weight: 400 !important;
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
  .ant-table-wrapper {
    .ant-table {
      border-radius: 8px !important;
    }
    .ant-table-container {
      border-radius: 0 0 8px 8px;
      border: 1px solid #0505050F;
    }
    .ant-table-content {
      border-radius: 8px;
    }
    .ant-table-thead >tr>th {
      white-space: nowrap;
      font-weight: 400 !important;
    }
    .ant-table-thead >tr>td {
      white-space: nowrap;
    }
    .ant-table {
      font-size: 13px !important;
    }
  }

  .ant-card-head-title, .ant-modal-title {
    font-weight: 400 !important;
  }

  .ant-select-dropdown .ant-select-item-option-selected {
    font-weight: 400 !important;
  }

  .ant-pagination .ant-pagination-item-active {
    font-weight: 400 !important;
  }

  // 对head右侧操作栏悬浮窗做样式处理
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

  ::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }
  ::-webkit-scrollbar-thumb {
    background-color: #D9D9D9;
    border-radius: 6px;
    background-clip: padding-box;
    border: 1px solid transparent
  }
`;

