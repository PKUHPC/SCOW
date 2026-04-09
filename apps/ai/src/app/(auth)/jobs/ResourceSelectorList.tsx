import type { CascaderProps } from "antd";
import type { FormListFieldData } from "antd/es/form";
import type { ReactNode } from "react";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { focusedBorderAndShadowStyle } from "@scow/lib-web/build/components/styledAntdCom/common";
import { cascaderArrowIcon, selectionArrowIcon } from "@scow/lib-web/build/icons/commonIcons";
import { Button, Cascader, Form, Tooltip } from "antd";
import { isValidElement, useRef, useMemo } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { createGlobalStyle, styled, useTheme } from "styled-components";

const RESOURCE_CASCADER_POPUP_CLASS = "resource-cascader-dropdown";
const RESOURCE_TOOLTIP_CLASS = "resource-selector-tooltip";

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
    color: ${({ theme }) => theme.palette.gray[6]} !important;
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

const SelectionArrowIcon = selectionArrowIcon;
const CascaderArrowIcon = cascaderArrowIcon;

const CascaderContainer = ({ className, ...props }: CascaderProps & { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={className}>
      <Cascader
        {...props}
        suffixIcon={<SelectionArrowIcon style={{ pointerEvents: "none" }} />}
        expandIcon={<CascaderArrowIcon />}
        dropdownAlign={{ offset: [0, 8] }}
        getPopupContainer={() => ref.current ?? document.body}
      />
    </div>
  );
};

const CascaderWrapper = styled(CascaderContainer)`
  position: relative;
  width: 100%;

  .ant-select {
    font-size: 14px !important;
    font-weight: lighter;
    height: 42px !important;
    box-shadow: none !important;
    width: 100%;
  }

  .ant-select-selector {
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05) !important;
    height: 42px !important;
    display: flex;
    align-items: center;
  }

  .ant-select-selection-item {
    font-size: 14px !important;
    display: flex;
    align-items: center;
  }

  .ant-select-selection-placeholder {
    font-size: 14px !important;
    color: ${({ theme }) => theme.palette.gray[6]} !important;
    display: flex;
    align-items: center;
  }

  ${focusedBorderAndShadowStyle}

  .ant-cascader-menus {
    display: flex;
    width: 100% !important;
  }

  .ant-cascader-menu {
    color: ${({ theme }) => theme.token.colorText} !important;
    flex: 0 0 14%;
    width: 14% !important;
    min-width: 150px !important;
    max-width: 14% !important;
    border-radius: 0 !important;
    overflow-y: auto !important;
    padding: 4px !important;
    box-sizing: border-box !important;
  }

  .ant-cascader-menu:nth-child(2) {
    flex: 0 0 50%;
    width: 50% !important;
    max-width: 50% !important;
  }

  .ant-cascader-menu:nth-child(3) {
    flex: 1 1 0 !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  .ant-cascader-menu-item {
    padding: 0 10px !important;
    height: 36px !important;
    line-height: 36px !important;
    display: flex !important;
    align-items: center !important;
    color: ${({ theme }) => theme.token.colorText} !important;
    border-radius: 8px !important;
  }

  .ant-cascader-menu-item-content {
    flex: 1;
    line-height: 36px !important;
  }

  .ant-cascader-menu-item-expand-icon {
    display: flex !important;
    align-items: center !important;
    height: 100% !important;
    line-height: 1 !important;
  }

  .ant-cascader-menu-item:hover,
  .ant-cascader-menu-item-active {
    font-weight: normal !important;
    background: ${({ theme }) => theme.token.colorPrimaryBg} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  .ant-cascader-menu-item-active .ant-cascader-menu-item-expand-icon svg path[fill-rule] {
    fill: ${({ theme }) => theme.token.colorPrimary} !important;
  }
`;

export const AddButton = styled(Button)`
  width: 152px;
  height: 42px !important;
  padding: 0 24px !important;
  border-radius: 8px !important;
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
  gap: 10px !important;
  color: ${({ theme }) => theme.palette.gray[6]} !important;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.05) !important;

  &:hover {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  .ant-btn-icon {
    margin-inline-end: 0 !important;
    width: 24px !important;
  }
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
  color: ${({ theme }) => theme.token.colorPrimary} !important;
  border-color: ${({ theme }) => theme.token.colorPrimary} !important;
  box-shadow: 0px 2px 2px 0px rgba(40, 95, 212, 0.05);
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
  ownerText?: string;
  children: ResourceOptionNode[];
}

export type ResourceCategory = ResourceOptionNode;

const renderWithTooltip = (label: string, description?: string): ReactNode =>
  description ? (
    <Tooltip
      title={description}
      placement="right"
      overlayClassName={RESOURCE_TOOLTIP_CLASS}
      overlayStyle={{ maxWidth: 280 }}
    >
      <span>{label}</span>
    </Tooltip>
  ) : (
    label
  );

const extractLabelText = (label: ReactNode): string => {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  if (Array.isArray(label)) {
    return label
      .map((child) => extractLabelText(child))
      .filter(Boolean)
      .join("");
  }
  if (isValidElement(label)) {
    if ((label.props as Record<string, unknown>)?.["data-display-only"]) return "";
    return extractLabelText(label.props?.children);
  }
  return "";
};

const defaultDisplayRender = (labels: ReactNode[], selectedOptions?: unknown[]) => {
  const pathText = labels
    .map((label) => extractLabelText(label))
    .filter(Boolean)
    .join(" / ");

  const ownerText = (selectedOptions as Record<string, unknown>[] | undefined)
    ?.map((opt) => opt.ownerText as string | undefined)
    .find(Boolean);

  if (!ownerText) return pathText;
  return (
    <span>
      {pathText}
      <OwnerDisplayText>{ownerText}</OwnerDisplayText>
    </span>
  );
};

export const OwnerDisplayText = styled.span`
  color: ${({ theme }) => theme.palette.gray[6]};
  font-size: 13px;
  margin-left: 16px;
`;

const StyledPublicResourceOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;

  .resource-name {
    font-weight: 500;
    color: ${({ theme }) => theme.token.colorText};
  }

  .resource-owner {
    color: ${({ theme }) => theme.palette.gray[6]};
    font-size: 13px;
  }
`;

const renderOptionLabel = (node: ResourceOptionNode): ReactNode => {
  const nameNode = renderWithTooltip(node.label, node.description);
  if (!node.ownerText) return nameNode;
  return (
    <StyledPublicResourceOption>
      <span className="resource-name">{nameNode}</span>
      <span className="resource-owner" data-display-only="true">
        {node.ownerText}
      </span>
    </StyledPublicResourceOption>
  );
};

const generateOptions = (categories: ResourceCategory[]): CascaderProps["options"] =>
  categories.map((category) => ({
    value: category.value,
    label: renderOptionLabel(category),
    ownerText: category.ownerText,
    children:
      category.children?.map((child) => ({
        value: child.value,
        label: renderOptionLabel(child),
        ownerText: child.ownerText,
        children:
          child.children?.map((grandChild) => ({
            value: grandChild.value,
            label: renderOptionLabel(grandChild),
            ownerText: grandChild.ownerText,
          })) ?? [],
      })) ?? [],
  }));

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
) =>
  fields.map((field) => (
    <Row key={field.key}>
      <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: requiredMessage }]}>
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

      <RowRemoveButton icon={<MinusOutlined />} onClick={() => remove(field.name)} aria-label={removeAriaLabel} />
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
    ? [
        {
          validator: async (_: unknown, value: unknown[]) => validateListNotEmpty(_, value, emptyMessage),
        },
      ]
    : [];
  const requiredMessageText = requiredMessage ?? t(p("defaultRequiredMessage"));
  const removeAriaLabel = t(p("removeAriaLabel"));

  return (
    <>
      <ResourceTooltipStyles />
      <Form.List name={name} rules={listRules}>
        {(fields, { add, remove }, { errors }) => (
          <ListContainer>
            {renderListItems(fields, remove, options, placeholder, displayRender, requiredMessageText, removeAriaLabel)}

            <AddButton
              icon={<PlusOutlined style={{ color: theme.token.colorPrimary }} />}
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
