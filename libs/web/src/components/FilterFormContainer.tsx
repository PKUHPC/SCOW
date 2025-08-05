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

import { Tabs } from "antd";
import { styled } from "styled-components";

export const FilterFormContainer = styled.div`
  padding: 8px 16px 16px 16px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;

  .ant-form-item {
    margin: 4px;
    max-width: 100%;
  }

`;

const NoShakeTab = styled(Tabs)`
  .ant-tabs-nav-operations {
    display: none !important;
  }
`;

const TabFormContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

interface TabbedFilterFormProps {
  button?: JSX.Element;
  tabs: { title: string; key?: string; node?: JSX.Element; }[];
  onChange?: (activeKey: string) => void;
}

export const FilterFormTabs: React.FC<TabbedFilterFormProps> = ({
  button, tabs, onChange,
}) => {
  return (
    <NoShakeTab
      defaultActiveKey={tabs.length > 0 ? tabs[0].title : ""}
      size="small"
      tabBarExtraContent={button}
      onChange={onChange}
    >
      {
        tabs.map(({ title, key, node }) => (
          <Tabs.TabPane tab={title} key={key ?? title}>
            <TabFormContainer>
              {node}
            </TabFormContainer>
          </Tabs.TabPane>
        ))
      }
    </NoShakeTab>
  );
};
