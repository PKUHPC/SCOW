import { Select, type SelectProps } from "antd";
import { styled } from "styled-components";

import { RoundedSearch, type RoundedSearchProps } from "./Input";

export type SelectSearchLabelAlign = "left" | "center";

const StyledSearch = styled(RoundedSearch)<{
  $labelAlign: SelectSearchLabelAlign;
  $labelWidth: number;
  $width: number;
}>`
  width: ${({ $width }) => $width}px !important;
  max-width: 100%;

  .ant-input-wrapper {
    width: 100%;
  }

  .ant-input-group > .ant-input-group-addon:first-child {
    padding: 0;
    background: ${({ theme }) => theme.token.colorBgContainer};
    border: none !important;
    border-right: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    box-shadow: none;
  }

  .ant-select {
    width: ${({ $labelWidth }) => $labelWidth}px;
  }

  .ant-select-selector {
    padding: 0 24px !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .ant-select-selection-item {
    overflow: visible;
    text-overflow: clip;
    text-align: ${({ $labelAlign }) => $labelAlign};
    padding-right: ${({ $labelAlign }) => ($labelAlign === "left" ? "28px" : "0")} !important;
  }

  .ant-select-arrow {
    right: 24px;
  }

  .ant-input-wrapper .ant-input {
    border: none !important;
  }

  .ant-input-search-button {
    border: none !important;
    border-left: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    box-shadow: none !important;
  }
`;

export interface SelectSearchProps<ValueType extends string> extends Omit<RoundedSearchProps, "addonBefore"> {
  /** 搜索类型下拉框中可选择的选项。 */
  labelOptions: SelectProps<ValueType>["options"];
  /** 当前选中的搜索类型。 */
  labelValue: ValueType;
  /** 切换搜索类型时触发，不会自动提交搜索。 */
  onLabelChange: (value: ValueType) => void;
  /** 搜索类型文字的水平对齐方式，默认左对齐。 */
  labelAlign?: SelectSearchLabelAlign;
  /** 搜索类型选择框及其下拉菜单的宽度，单位为 px。 */
  labelWidth?: number;
  /** 选择框、输入框和搜索按钮组成的完整搜索框宽度，单位为 px。 */
  width?: number;
}

export const SelectSearch = <ValueType extends string>({
  labelOptions,
  labelValue,
  onLabelChange,
  labelAlign = "left",
  labelWidth = 160,
  width = 360,
  ...searchProps
}: SelectSearchProps<ValueType>) => (
  <StyledSearch
    {...searchProps}
    $labelAlign={labelAlign}
    $labelWidth={labelWidth}
    $width={width}
    addonBefore={
      <Select
        value={labelValue}
        options={labelOptions}
        popupMatchSelectWidth={labelWidth}
        onChange={onLabelChange}
      />
    }
  />
);
