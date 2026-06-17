import { Tabs, TabsProps } from "antd";
import { styled } from "styled-components";

export const FilterFormContainer = styled.div`
  padding: 12px 12px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;

  .ant-form-item {
    margin: 6px 10px;
    max-width: 100%;
  }
`;

// 与文字排列对齐不显示边框
export const FilterFormContainerWithoutBorder = styled.div`
  padding: 0px 16px 8px 0px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  .ant-form-item {
    margin: 0px;
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
  tabs: { title: string; key?: string; node?: JSX.Element }[];
  onChange?: (activeKey: string) => void;
}

export const FilterFormTabs: React.FC<TabbedFilterFormProps> = ({ button, tabs, onChange }) => {
  const items: TabsProps["items"] = tabs.map(({ title, key, node }) => ({
    key: key ?? title,
    label: title,
    children: <TabFormContainer>{node}</TabFormContainer>,
  }));
  return (
    <NoShakeTab
      defaultActiveKey={tabs.length > 0 ? tabs[0].title : ""}
      size="small"
      tabBarExtraContent={button}
      onChange={onChange}
      items={items}
    />
  );
};
