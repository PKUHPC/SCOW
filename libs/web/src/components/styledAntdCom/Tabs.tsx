import { Tabs, TabsProps } from "antd";
import { createElement } from "react";
import { styled } from "styled-components";

type TabsWrapperProps = TabsProps & { className?: string };

const TabsWrapper = ({ className, ...tabsProps }: TabsWrapperProps) =>
  createElement("div", { className }, createElement(Tabs, tabsProps));

/**
 * 给 StyledTabs 增加了一个包裹组件 TabsWrapper
 * 把 Tabs 渲染在外层 div 中，并让 styled-components 作用在这个外层
 * 从而避免向 Ant Design 的函数组件传递 ref 导致的警告
 */
export const StyledTabs = styled(TabsWrapper)`
  .ant-tabs-nav {
    margin: 0 0 16px;
    padding: 0 8px;
  }

  .ant-tabs-content-holder {
    max-height: none;
    overflow: visible;
  }

  .ant-table-thead {
    height: 54px;
  }

  .ant-tabs-nav::before {
    border-bottom: 1px solid ${({ theme }) => theme.token.colorSplit};
  }

  .ant-tabs-tab {
    padding: 12px 0;
    margin: 0;
    color: ${({ theme }) => theme.palette.gray[6]} !important;
    font-size: 15px;
  }

  .ant-tabs-tab:hover .ant-tabs-tab-btn {
    color: ${({ theme }) => theme.token.colorPrimary};
  }

  .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
    color: ${({ theme }) => theme.token.colorPrimary};
  }

  .ant-tabs-ink-bar {
    height: 3px;
    border-radius: 3px;
    background: ${({ theme }) => theme.token.colorPrimary};
  }
`;
