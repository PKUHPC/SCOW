import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import type { CascaderProps } from "antd";
import { Button, Cascader, Form, Tooltip } from "antd";
import type { FormListFieldData } from "antd/es/form";
import type { ReactNode } from "react";
import { isValidElement, useMemo } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { createGlobalStyle, styled, useTheme } from "styled-components";

const RESOURCE_CASCADER_POPUP_CLASS = "resource-cascader-dropdown";
const RESOURCE_TOOLTIP_CLASS = "resource-selector-tooltip";

const ResourceCascaderPopupStyles = createGlobalStyle`
  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menus {
    width: 100% !important;
    min-width: 100% !important;
    display: flex;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu {
    color: ${({ theme }) => theme.token.colorText} !important;
    flex: 1 1 25%;
    min-width: 0;
    border-radius: 0 !important;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu:nth-child(2) {
    flex: 3 1 50%;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu:nth-child(3) {
    flex: 1 1 25%;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu-item {
    padding: 10px 14px !important;
    min-height: 36px !important;
    line-height: 20px !important;
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.token.colorText} !important;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu-item:hover {
    border-radius: 8px;
  }

  .${RESOURCE_CASCADER_POPUP_CLASS} .ant-cascader-menu-item-active {
    font-weight: normal !important;
    background: ${({ theme }) => theme.token.colorPrimaryBg} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }
`;

const ResourceTooltipStyles = createGlobalStyle`
  .${RESOURCE_TOOLTIP_CLASS} {
    max-width: 280px !important;
    --antd-arrow-background-color: ${({ theme }) => theme.token.colorBgElevated};
    --antd-arrow-border-color: ${({ theme }) => theme.token.colorBorderSecondary};
  }

  .${RESOURCE_TOOLTIP_CLASS} .ant-tooltip-inner {
    padding: 12px 24px !important;
    border-radius: 8px !important;
    border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary} !important;
    background: ${({ theme }) => theme.token.colorBgElevated} !important;
    color: rgba(136, 143, 163, 1) !important;
    font-size: 12px !important;
    line-height: 20px !important;
    word-break: break-word !important;
  }

  .${RESOURCE_TOOLTIP_CLASS} .ant-tooltip-arrow {
    display: none !important;
  }
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const CascaderWrapper = styled(Cascader)`
  width: 100%;

  .ant-cascader-picker {
    width: 100%;
    height: 44px;
    border-radius: 12px !important;
    padding: 0 12px !important;
    display: flex;
    align-items: center;
    border-color: ${({ theme }) => theme.token.colorPrimaryBgHover};
    box-shadow: none !important;
  }

  .ant-cascader-picker:hover,
  .ant-cascader-picker-focused {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none !important;
  }

  .ant-cascader-picker-placeholder {
    color: ${({ theme }) => theme.token.colorTextDescription} !important;
  }

  .ant-cascader-picker-label {
    line-height: 44px;
  }
`;

export const AddButton = styled(Button)`
  width: 160px;
  height: 42px !important;
  padding: 0 16px !important;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05);

  color:rgba(136, 143, 163, 1) !important;
`;

export const RemoveButton = styled(Button)`
  width: 22px !important;
  height: 22px !important;
  min-width: 22px !important;
  border-radius: 11px !important;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: ${({ theme }) => theme.token.colorBorderSecondary} !important;
  color: ${({ theme }) => theme.token.colorTextDescription} !important;
  background: ${({ theme }) => theme.token.colorFillQuaternary} !important;
  box-shadow: 0px 2px 2px 0px rgba(40, 95, 212, 0.05);

  &:hover {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  &:disabled {
    opacity: 0.5;
    color: ${({ theme }) => theme.token.colorTextDisabled} !important;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
  }
`;

const ErrorList = styled(Form.ErrorList)`
  margin: 0 !important;
  margin-top: -4px !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  color: ${({ theme }) => theme.token.colorError} !important;
  list-style: none;

  li {
    margin: 0 !important;
  }
`;

export interface ResourceOptionNode {
  label: string;
  value: number;
  description?: string;
  children: ResourceOptionNode[];
}

export type ResourceCategory = ResourceOptionNode;

const renderWithTooltip = (label: string, description?: string): ReactNode => (
  description ? (
    <Tooltip
      title={description}
      placement="right"
      overlayClassName={RESOURCE_TOOLTIP_CLASS}
      overlayStyle={{ maxWidth: 280 }}
    >
      <span>{label}</span>
    </Tooltip>
  ) : label
);

const extractLabelText = (label: ReactNode): string => {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  if (Array.isArray(label)) {
    return label.map((child) => extractLabelText(child)).filter(Boolean).join("");
  }
  if (isValidElement(label)) {
    return extractLabelText(label.props?.children);
  }
  return "";
};

const defaultDisplayRender = (labels: ReactNode[]) =>
  labels.map((label) => extractLabelText(label)).filter(Boolean).join(" / ");

const generateOptions = (categories: ResourceCategory[]): CascaderProps["options"] => (
  categories.map((category) => ({
    value: category.value,
    label: renderWithTooltip(category.label, category.description),
    children: category.children?.map((child) => ({
      value: child.value,
      label: renderWithTooltip(child.label, child.description),
      children: child.children?.map((grandChild) => ({
        value: grandChild.value,
        label: renderWithTooltip(grandChild.label, grandChild.description),
      })) ?? [],
    })) ?? [],
  }))
);

const validateListNotEmpty = async (_: unknown, value: unknown[], message: string) => {
  if (!value || value.length === 0) {
    return Promise.reject(new Error(message));
  }
  return Promise.resolve();
};

const RowRemoveButton = styled(RemoveButton)`
  margin-top: 10px;
`;

const renderListItems = (
  fields: FormListFieldData[],
  remove: (index: number | number[]) => void,
  options: CascaderProps["options"],
  placeholder: string,
  displayRender: (labels: ReactNode[]) => ReactNode,
  requiredMessage: string,
  removeAriaLabel: string,
) => fields.map((field) => (
  <Row key={field.key}>
    <Form.Item
      {...field}
      style={{ flex: 1, marginBottom: 0 }}
      rules={[{ required: true, message: requiredMessage }]}
    >
      <CascaderWrapper
        size="large"
        options={options}
        placeholder={placeholder}
        expandTrigger="hover"
        displayRender={displayRender}
        dropdownMatchSelectWidth
        popupClassName={RESOURCE_CASCADER_POPUP_CLASS}
        allowClear
      />
    </Form.Item>

    <RowRemoveButton
      icon={<MinusOutlined />}
      onClick={() => remove(field.name)}
      aria-label={removeAriaLabel}
    />
  </Row>
));

export interface ResourceSelectorListProps {
  name: string;
  placeholder: string;
  addButtonText: string;
  emptyMessage?: string;
  requiredMessage?: string;
  categories: ResourceCategory[];
  displayRender?: (labels: ReactNode[]) => ReactNode;
}

const p = prefix("app.jobs.resourceSelectorList.");

export const ResourceSelectorList = ({
  name,
  placeholder,
  addButtonText,
  emptyMessage,
  requiredMessage,
  categories,
  displayRender = defaultDisplayRender,
}: ResourceSelectorListProps) => {
  const theme = useTheme();
  const t = useI18nTranslateToString();
  const options = useMemo(() => generateOptions(categories), [categories]);
  const listRules = emptyMessage
    ? [{
      validator: async (_: unknown, value: unknown[]) => validateListNotEmpty(_, value, emptyMessage),
    }]
    : [];
  const requiredMessageText = requiredMessage ?? t(p("defaultRequiredMessage"));
  const removeAriaLabel = t(p("removeAriaLabel"));

  return (
    <>
      <ResourceCascaderPopupStyles />
      <ResourceTooltipStyles />
      <Form.List
        name={name}
        rules={listRules}
      >
        {(fields, { add, remove }, { errors }) => (
          <ListContainer>
            {renderListItems(
              fields,
              remove,
              options,
              placeholder,
              displayRender,
              requiredMessageText,
              removeAriaLabel,
            )}

            <AddButton
              icon={<PlusOutlined style={{ color:theme.token.colorPrimary }} />}
              onClick={() => add(undefined)}
            >
              {addButtonText}
            </AddButton>

            <ErrorList errors={errors} />
          </ListContainer>
        )}
      </Form.List>
    </>
  );
};
