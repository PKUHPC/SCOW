import type { CascaderProps } from "antd";
import type { InputProps } from "antd/es/input";
import type { ChangeEvent } from "react";
import type { ReactNode } from "react";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { focusedBorderAndShadowStyle } from "@scow/lib-web/build/components/styledAntdCom/common";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { cascaderArrowIcon, selectionArrowIcon } from "@scow/lib-web/build/icons/commonIcons";
import { Button, Cascader, Form, Tooltip } from "antd";
import { isValidElement, useEffect, useMemo, useRef } from "react";
import { AutoScrollText } from "src/components/AutoScrollText";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { createGlobalStyle, styled, useTheme } from "styled-components";

import { createMountTargetRules } from "./common";
import { BuiltinTooltipProps } from "./EnvironmentVariableList";
import {
  CATEGORY_VALUE_PRIVATE,
  CATEGORY_VALUE_PUBLIC,
  ResourceCategory,
  ResourceOptionNode,
} from "./ResourceSelector.shared";

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
    height: 36px !important;
    box-shadow: none !important;
    width: 100%;
  }

  .ant-select-selector {
    box-sizing: border-box !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[4]} !important;
    border-radius: 4px !important;
    box-shadow: none !important;
    height: 36px !important;
    display: flex;
    align-items: center;
    background-color: ${({ theme }) => theme.token.colorBgContainer} !important;
  }

  .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
    border-color: ${({ theme }) => theme.palette.gray[4]} !important;
  }

  .ant-select-selection-item {
    font-size: 14px !important;
    display: flex;
    align-items: center;
    overflow: hidden !important;
    min-width: 0 !important;
    margin-inline-end: 30px !important;
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
  }

  .ant-cascader-menu {
    color: ${({ theme }) => theme.token.colorText} !important;
    flex: 0 0 auto;
    width: 140px !important;
    min-width: 100px !important;
    border-radius: 0 !important;
    overflow-y: auto !important;
    padding: 4px !important;
    box-sizing: border-box !important;
  }

  .ant-cascader-menu:nth-child(2) {
    width: 240px !important;
  }

  .ant-cascader-menu:nth-child(3) {
    width: 200px !important;
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
    min-width: 0;
    line-height: 36px !important;
    white-space: nowrap !important;
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

export const RESOURCE_MOUNT_TYPES = {
  DATASET: "dataset",
  ALGORITHM: "algorithm",
  MODEL: "model",
} as const;

export type ResourceMountType = (typeof RESOURCE_MOUNT_TYPES)[keyof typeof RESOURCE_MOUNT_TYPES];

export const PRIVATE_ASSET_MOUNT_PREFIX = "/mnt/private_asset";
export const PUBLIC_ASSET_MOUNT_PREFIX = "/mnt/public_asset";

const renderWithTooltip = (label: string, description?: string): ReactNode =>
  description ? (
    <Tooltip
      title={description}
      placement="top"
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

  const ownerText = (selectedOptions as (Record<string, unknown> | null | undefined)[] | undefined)
    ?.map((opt) => opt?.ownerText as string | undefined)
    .find(Boolean);

  const fullText = ownerText ? `${pathText}  ${ownerText}` : pathText;

  return (
    <Tooltip title={fullText} mouseEnterDelay={0.5}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
        {fullText}
      </span>
    </Tooltip>
  );
};

const StyledPublicResourceOption = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  white-space: nowrap;

  .resource-name {
    font-weight: 500;
    color: ${({ theme }) => theme.token.colorText};
    flex-shrink: 0;
  }

  .resource-owner {
    color: ${({ theme }) => theme.palette.gray[6]};
    font-size: 13px;
    flex-shrink: 0;
  }
`;

const renderOptionLabel = (node: ResourceOptionNode): ReactNode => {
  const nameNode = renderWithTooltip(node.label, node.description);
  if (!node.ownerText) {
    return <AutoScrollText>{nameNode}</AutoScrollText>;
  }
  return (
    <AutoScrollText>
      <StyledPublicResourceOption>
        <span className="resource-name">{nameNode}</span>
        <span className="resource-owner" data-display-only="true">
          {node.ownerText}
        </span>
      </StyledPublicResourceOption>
    </AutoScrollText>
  );
};

const generateOptions = (categories: ResourceCategory[]): CascaderProps["options"] =>
  categories.map((category) => ({
    value: category.value,
    label: renderOptionLabel(category),
    rawLabel: category.label,
    ownerText: category.ownerText,
    children:
      category.children?.map((child) => ({
        value: child.value,
        label: renderOptionLabel(child),
        rawLabel: child.label,
        ownerText: child.ownerText,
        children:
          child.children?.map((grandChild) => ({
            value: grandChild.value,
            label: renderOptionLabel(grandChild),
            rawLabel: grandChild.label,
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

interface ResourceSelectorFieldValue {
  // Cascader 选择路径：[我的/公共分类, 资源, 版本]。
  selection?: (string | number | null)[];
  // 用户最终提交的挂载路径。默认会自动生成，但允许用户手动清空或改写。
  target?: string;
  // 最近一次由资源选择自动生成的挂载路径，用来判断当前 target 是否仍是自动值。
  __autoTarget?: string;
  // 自动生成路径依赖资源名/版本名；如果这些名字不适合作为路径段，则只拦截未被用户改写的自动值。
  __autoTargetInvalid?: boolean;
  // 用户是否手动编辑过 target。编辑后不再被资源列表异步刷新覆盖。
  __targetTouched?: boolean;
}

const RowRemoveButton = styled(RemoveButton)`
  margin-top: 10px;
`;

const TargetInputWithTooltip = ({
  tooltipTitle,
  toolTipColor,
  onTargetEdited,
  onChange,
  ...inputProps
}: InputProps & { tooltipTitle: string; toolTipColor: string; onTargetEdited?: () => void }) => (
  <Tooltip title={tooltipTitle} {...BuiltinTooltipProps} color={toolTipColor}>
    <RoundedInput
      {...inputProps}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        onTargetEdited?.();
        onChange?.(event);
      }}
    />
  </Tooltip>
);

export interface ResourceSelectorListProps {
  name: string;
  resourceType: ResourceMountType;
  placeholder: string;
  addButtonText: string;
  emptyMessage?: string;
  requiredMessage?: string;
  categories: ResourceCategory[];
  displayRender?: (labels: ReactNode[]) => ReactNode;
}

const p = prefix("app.jobs.resourceSelectorList.");
const pMount = prefix("app.jobs.mountPointList.");
const pPathValidation = prefix("common.pathValidation.");

export const ResourceSelectorList = ({
  name,
  resourceType,
  placeholder,
  addButtonText,
  emptyMessage,
  requiredMessage,
  categories,
  displayRender = defaultDisplayRender,
}: ResourceSelectorListProps) => {
  const theme = useTheme();
  const t = useI18nTranslateToString();
  const form = Form.useFormInstance();
  const options = useMemo(() => generateOptions(categories), [categories]);
  const selectedResources = Form.useWatch(name, form) as ResourceSelectorFieldValue[] | undefined;
  const selectedResourceSelectionsKey = useMemo(
    () => JSON.stringify((selectedResources ?? []).map((item) => item?.selection ?? null)),
    [selectedResources],
  );
  const listRules = emptyMessage
    ? [
        {
          validator: async (_: unknown, value: unknown[]) => validateListNotEmpty(_, value, emptyMessage),
        },
      ]
    : [];
  const requiredMessageText = requiredMessage ?? t(p("defaultRequiredMessage"));
  const removeAriaLabel = t(p("removeAriaLabel"));
  const resourceToolTip = t(p("resourceToolTip"));
  const targetPlaceholder = t("app.jobs.mountPointList.targetPlaceholder");
  const toolTipColor = theme.palette.gray[7];

  const isValidGeneratedPathSegment = (segment: string | undefined) => {
    if (!segment?.trim()) return false;
    const trimmed = segment.trim();
    return trimmed !== "." && trimmed !== ".." && !trimmed.includes("/") && !trimmed.includes("\\");
  };

  const buildDefaultTarget = (
    isPrivateCategory: boolean,
    resourceName: string | undefined,
    versionName: string | undefined,
  ) => {
    const prefix = isPrivateCategory ? PRIVATE_ASSET_MOUNT_PREFIX : PUBLIC_ASSET_MOUNT_PREFIX;
    return `${prefix}/${resourceType}/${resourceName ?? ""}/${versionName ?? ""}`;
  };

  const getSelectionMeta = (value: (string | number | null)[] | undefined) => {
    // 资源 options 可能在表单初始值之后才加载完成；这里通过 selection 重新找到资源名/版本名，
    // 让已有选择也能在 options 到达后补齐默认挂载路径。
    const rootCategory = value?.[0];
    const normalizedRootCategory = typeof rootCategory === "string" ? Number(rootCategory) : rootCategory;
    const isPrivateCategory = normalizedRootCategory === CATEGORY_VALUE_PRIVATE;
    const isPublicCategory = normalizedRootCategory === CATEGORY_VALUE_PUBLIC;

    if (!isPrivateCategory && !isPublicCategory) {
      return undefined;
    }

    const category = categories.find((x) => x.value === normalizedRootCategory);
    const resourceValue = value?.[1];
    const versionValue = value?.[2];
    const normalizedResourceValue = typeof resourceValue === "string" ? Number(resourceValue) : resourceValue;
    const normalizedVersionValue = typeof versionValue === "string" ? Number(versionValue) : versionValue;
    const resource = category?.children.find((x) => x.value === normalizedResourceValue);
    const version = resource?.children.find((x) => x.value === normalizedVersionValue);
    const resourceName = resource?.label;
    const versionName = version?.label;
    const defaultTarget = buildDefaultTarget(isPrivateCategory, resourceName, versionName);

    return {
      defaultTarget,
      isGeneratedTargetInvalid: !isValidGeneratedPathSegment(resourceName) || !isValidGeneratedPathSegment(versionName),
    };
  };

  useEffect(() => {
    const currentResources = form.getFieldValue(name) as ResourceSelectorFieldValue[] | undefined;

    if (!currentResources?.length) {
      return;
    }

    const fieldsToValidate: [string, number, string][] = [];

    currentResources.forEach((item, index) => {
      const meta = getSelectionMeta(item?.selection);
      if (!meta) {
        return;
      }

      // 再次提交会先把历史 target 回填进表单，此时还没有 __autoTarget 元数据。
      // 这种已有 target 应视为用户上一次提交的记录值，不能被默认路径覆盖；新添加项 target 为空时仍走自动填充。
      const hasPersistedTarget = item.__autoTarget === undefined && Boolean(item.target);
      if (hasPersistedTarget) {
        return;
      }

      // 用户已经手动改过 target 时保留用户输入；如果当前值仍等于上一次自动值，
      // 说明还没有真正脱离自动填充，可以继续跟随新的资源/版本更新。
      const targetWasAutoFilled = item.__autoTarget !== undefined && item.target === item.__autoTarget;
      if (item.__targetTouched && !targetWasAutoFilled) {
        return;
      }

      // 避免在默认路径已经同步完成后重复写入表单。
      if (
        item.target === meta.defaultTarget &&
        item.__autoTarget === meta.defaultTarget &&
        item.__autoTargetInvalid === meta.isGeneratedTargetInvalid
      ) {
        return;
      }

      form.setFieldValue([name, index, "target"], meta.defaultTarget);
      form.setFieldValue([name, index, "__autoTarget"], meta.defaultTarget);
      form.setFieldValue([name, index, "__autoTargetInvalid"], meta.isGeneratedTargetInvalid);
      form.setFieldValue([name, index, "__targetTouched"], false);
      fieldsToValidate.push([name, index, "target"]);
    });

    if (fieldsToValidate.length > 0) {
      form.validateFields(fieldsToValidate).catch(() => undefined);
    }
  }, [categories, form, name, selectedResourceSelectionsKey]);

  const handleCascaderChange =
    (fieldName: number) =>
    (value: (string | number | null)[], selectedOptions?: (Record<string, unknown> | null | undefined)[]) => {
      const rootCategory = value?.[0];
      const normalizedRootCategory = typeof rootCategory === "string" ? Number(rootCategory) : rootCategory;
      const isPrivateCategory = normalizedRootCategory === CATEGORY_VALUE_PRIVATE;
      const isPublicCategory = normalizedRootCategory === CATEGORY_VALUE_PUBLIC;

      if (isPrivateCategory || isPublicCategory) {
        const resourceName = selectedOptions?.[1]?.rawLabel as string | undefined;
        const versionName = selectedOptions?.[2]?.rawLabel as string | undefined;
        const meta = {
          defaultTarget: buildDefaultTarget(isPrivateCategory, resourceName, versionName),
          isGeneratedTargetInvalid:
            !isValidGeneratedPathSegment(resourceName) || !isValidGeneratedPathSegment(versionName),
        };

        form.setFieldValue([name, fieldName, "target"], meta.defaultTarget);
        form.setFieldValue([name, fieldName, "__autoTarget"], meta.defaultTarget);
        form.setFieldValue([name, fieldName, "__autoTargetInvalid"], meta.isGeneratedTargetInvalid);
        form.setFieldValue([name, fieldName, "__targetTouched"], false);
      } else {
        form.setFieldValue([name, fieldName, "target"], "");
        form.setFieldValue([name, fieldName, "__autoTarget"], undefined);
        form.setFieldValue([name, fieldName, "__autoTargetInvalid"], false);
        form.setFieldValue([name, fieldName, "__targetTouched"], false);
      }
      form.validateFields([[name, fieldName, "target"]]);
    };

  return (
    <>
      <ResourceTooltipStyles />
      <Form.List name={name} rules={listRules}>
        {(fields, { add, remove }, { errors }) => (
          <ListContainer>
            {fields.map(({ key, ...field }) => (
              <Row key={key}>
                <Form.Item
                  {...field}
                  name={[field.name, "selection"]}
                  style={{ flex: 1, minWidth: 0, marginBottom: 0 }}
                  rules={[{ required: true, message: requiredMessageText }]}
                >
                  <CascaderWrapper
                    size="large"
                    options={options}
                    placeholder={placeholder}
                    expandTrigger="hover"
                    displayRender={displayRender}
                    dropdownMatchSelectWidth={false}
                    popupClassName={RESOURCE_CASCADER_POPUP_CLASS}
                    allowClear
                    onChange={handleCascaderChange(field.name)}
                  />
                </Form.Item>

                <Form.Item
                  name={[field.name, "target"]}
                  style={{ flex: 1, minWidth: 0, marginBottom: 0 }}
                  rules={[
                    { required: true, message: t(pMount("targetRequired")) },
                    ...createMountTargetRules(
                      ["datasets", "algorithms", "models", "mountPoints"],
                      name,
                      field.name,
                      t(pMount("targetRootNotAllowed")),
                      t(pMount("duplicateTarget")),
                      {
                        unsafeCharacter: t(pPathValidation("unsafeCharacter")),
                        pathTraversal: t(pPathValidation("pathTraversal")),
                        currentDirectory: t(pPathValidation("currentDirectory")),
                        absoluteRequired: t(pPathValidation("absoluteRequired")),
                        systemPathNotAllowed: t(pPathValidation("targetSystemPathNotAllowed")),
                      },
                    ),
                    ({ getFieldValue }) => ({
                      validator: (_: unknown, value?: string) => {
                        const autoTarget = getFieldValue([name, field.name, "__autoTarget"]);
                        const autoTargetInvalid = getFieldValue([name, field.name, "__autoTargetInvalid"]);
                        // 只拦截有问题的自动生成值；用户手动改成其他合法路径时，交给通用挂载路径规则校验。
                        if (autoTargetInvalid && value === autoTarget) {
                          return Promise.reject(new Error(t(p("invalidGeneratedTarget"))));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <TargetInputWithTooltip
                    size="large"
                    placeholder={targetPlaceholder}
                    tooltipTitle={resourceToolTip}
                    onTargetEdited={() => {
                      form.setFieldValue([name, field.name, "__targetTouched"], true);
                    }}
                    toolTipColor={toolTipColor}
                  />
                </Form.Item>

                <RowRemoveButton
                  icon={<MinusOutlined />}
                  onClick={() => remove(field.name)}
                  aria-label={removeAriaLabel}
                />
              </Row>
            ))}

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
