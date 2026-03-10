import { RoundedInput, RoundedInputNumber,
  RoundedPasswordInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import type { TableProps, TabsProps } from "antd";
import type { SelectProps } from "antd";
import { Avatar, Button, Card, Checkbox, InputNumber, Segmented, Select,
  Space, Table, Tabs, Typography } from "antd";
import { createElement } from "react";
import styled from "styled-components";

export const PaddedCard = styled(Card)`
  border: 1px solid #F0F0F0;
  border-radius: 8px;

  .ant-card-head {
    padding: 16px 36px !important;
  }

  .ant-card-body {
    padding: 24px 24px 0 !important;
  }
`;

export const HeaderRow = styled(Space)`
  width: 100%;

  && {
    display: flex;
    align-items: center;
  }

  && .ant-space-item {
    display: flex;
    align-items: center;
  }
`;

export const HeaderAvatar = styled(Avatar)`
  background-color: rgba(240, 240, 240, 1) !important;
`;

export const HeaderTitle = styled.span`
  font-size: 20px;
  line-height: 22px;
`;

export const BorderlessCard = styled(Card)`
  border: none !important;

  .ant-card-head {
    min-height: 0 !important;
    padding: 0 12px !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 26px 12px 0 12px !important;
  }
`;

export const SectionCard = styled(Card)`
  border: 1px solid rgba(240, 240, 240, 1);
  border-radius: 8px;

  .ant-card-head {
    padding: 26px 36px 0 !important;
    border: none !important;
  }

  .ant-card-body {
    padding: 16px 36px !important;
  }
`;

export const SectionTitle = styled(Typography.Text)`
  font-weight: 600;
  color: #434343;
`;

export const Label = styled(Typography.Text)`
  font-weight: lighter !important;
  color: rgba(136, 143, 163, 1) !important;
`;

type RoundedSelectProps = SelectProps & { $noShadow?: boolean };

export const RoundedSelect = styled(Select)<RoundedSelectProps>`
  font-size: 14px !important;
  font-weight: lighter;
  box-shadow: ${({ $noShadow }) => $noShadow ? "none" : "0px 2px 2px 0px rgba(40, 95, 212, 0.05)"};
  height: 42px !important;

  && .ant-select-selector {
    border-radius: 8px !important;
    height: 42px !important;
    display: flex;
    align-items: center;
  }

  && .ant-select-selection-item {
    font-size: 14px !important;
    display: flex;
    align-items: center;
  }

  && .ant-select-selection-placeholder {
    font-size: 14px !important;
    color: rgba(136, 143, 163, 1) !important;
    display: flex;
    align-items: center;
  }
`;

export const StyledPublicImageOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;

  .image-name {
    font-weight: 500;
    color: ${({ theme }) => theme.token.colorText};
  }

  .image-owner {
    color: rgba(136, 143, 163, 1);
    font-size: 13px;
  }
`;

export const ImageSelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const ImageSegmentedControl = styled(Segmented)`
  width: 100%;
  padding: 5px 14px !important;
  border-radius: 8px;
  color: rgba(136, 143, 163, 1) !important;
  margin-bottom: 6px !important;

  .ant-segmented-item-label {
    font-size: 14px !important;
  }

  .ant-segmented-item-selected {
    background: ${({ theme }) => theme.token.colorBgContainer};
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none;
  }
`;

export const ImageDescriptionBox = styled.div`
  min-height: 72px;
  padding: 16px 20px;
  border-radius: 8px;
  background: rgba(250, 250, 250, 1);
  color: rgba(136, 143, 163, 1);
  line-height: 1.6;
`;


export const FixedFooter = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  padding: 10.5px 32px;
  margin-top: 12px;
  background: ${({ theme }) => theme.token.colorBgContainer};
  border-top: 1px solid ${({ theme }) => theme.token.colorSplit};
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
  z-index: 5;
`;

export const FooterStats = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  color: ${({ theme }) => theme.token.colorTextDescription};
  font-size: 13px;
  margin-right: 12px;

  span {
    position: relative;
    white-space: nowrap;
    padding-left: 12px;
  }

  span:first-child {
    padding-left: 0;
  }

  span + span::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 50%;
    width: 4px;
    height: 4px;
    background: ${({ theme }) => theme.token.colorSplit};
    border-radius: 50%;
    transform: translateY(-50%);
  }
`;

export const FooterStatValue = styled.span<{ $isPrimaryColor?: boolean }>`
  margin-left: 10px;
  color: ${({ theme, $isPrimaryColor }) =>
    $isPrimaryColor ? theme.token.colorPrimary : theme.token.colorTextBase};
`;

export const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const RoundedAfterInputNumber = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  box-shadow: 0px 2px 2px 0px rgba(40, 95, 212, 0.05);

  .ant-select-focused .ant-select-selector{
    color: ${({ theme }) => theme.token.colorText } !important;
  }
`;

export const ClusterButton = styled(Button)<{ $selected?: boolean }>`
  min-width: 110px;
  height: 44px;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  background: ${({ theme }) => theme.token.colorBgContainer} !important;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);
  color: rgba(136, 143, 163, 1) !important;

  ${({ $selected, theme }) => $selected && `
    border-color: ${theme.token.colorPrimary} !important;
    color: ${theme.token.colorPrimary} !important;
    box-shadow: none !important;
  `}

  &:disabled {
    opacity: .5;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    cursor: not-allowed;
  }
`;

type TabsWrapperProps = TabsProps & { className?: string };

const TabsWrapper = ({ className, ...tabsProps }: TabsWrapperProps) =>
  createElement(
    "div",
    { className },
    createElement(Tabs, tabsProps),
  );

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
    max-height: 340px;
    overflow-y: auto;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    height: 100%;
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
    color: rgba(136, 143, 163, 1) !important;
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

export const StyledTable = styled(Table)<TableProps<any>>`
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

export const AllocationLine = styled(Typography.Text)`
  display: block;
`;

export const SubtleCheckbox = styled(Checkbox)`
  margin-top: 8px;

  .ant-checkbox + span {
    color: rgba(136, 143, 163, 1);
  }
`;

export { RoundedInput, RoundedInputNumber,RoundedPasswordInput };
