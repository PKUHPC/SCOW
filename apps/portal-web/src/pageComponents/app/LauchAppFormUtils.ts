import type {
  AppCustomAttribute,
  CommandSelectReservedConfig,
  FixedValueConfig,
  ReservedAppAttribute,
  SelectConfig,
} from "src/pages/api/app/getAppMetadata";
import type { AppTemplateDetail } from "src/pages/api/app/listAppTemplates";

import { ReservedAppAttributeName } from "src/models/job";

import { getSelectAttributeInitalValue } from "./CreateAppCom/FixedOrEditableFormItem";

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
export const getInitialFixedValueByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): string | undefined => {
  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return undefined;
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "fixedValue") {
    return attribute.reservedConfig.fixedValue.value.toString();
  } else if (attribute.reservedConfig.type === "select") {
    const value = getSelectAttributeInitalValue(attribute.reservedConfig.defaultValue, attribute.reservedConfig.select);
    return value?.toString();
  }

  return undefined;
};

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
export const getFixedValueListByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): (string | number)[] => {
  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return [];
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "fixedValue") {
    return [attribute.reservedConfig.fixedValue.value];
  } else if (attribute.reservedConfig.type === "select") {
    return attribute.reservedConfig.select.map((x) => x.value);
  }

  return [];
};

export const isTemplateCustomAttributesAvailable = (
  customAttributes: string | undefined,
  attributes: AppCustomAttribute[],
): boolean => {
  const parsed = parseTemplateCustomAttributes(customAttributes);
  if (!parsed) {
    return false;
  }

  const visibleAttributeNames = getVisibleCustomTemplateFieldNames(attributes);
  const savedCustomFieldNames = getSavedCustomTemplateFieldNames(customAttributes);

  if (!savedCustomFieldNames) {
    return false;
  }

  if (savedCustomFieldNames.size !== visibleAttributeNames.length) {
    return false;
  }

  if (visibleAttributeNames.some((attributeName) => !savedCustomFieldNames.has(attributeName))) {
    return false;
  }

  return attributes
    .filter((attr) => savedCustomFieldNames.has(attr.name))
    .every((attr) => {
      const value = parsed[attr.name];
      if (value === undefined && !attr.required) {
        return true;
      }

      if (attr.fixedValue?.value !== undefined) {
        return value?.toString() === attr.fixedValue.value.toString();
      }

      if ((attr.type === "SELECT" || attr.type === "COMMAND_SELECT") && attr.select.length > 0) {
        return attr.select.some((option) => option.value === value);
      }

      return value !== undefined;
    });
};

const parseTemplateCustomAttributes = (
  customAttributes: string | undefined,
): Record<string, unknown> | undefined => {
  if (!customAttributes) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(customAttributes);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return undefined;
    }
    return parsedValue as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

export const templateCustomAttributesKey = "__scowTemplateCustomAttributes";

export const getVisibleCustomTemplateFieldNames = (attributes: AppCustomAttribute[]): string[] => {
  return attributes.filter((attr) => !attr.fixedValue?.hidden).map((attr) => attr.name);
};

export const getSavedCustomTemplateFieldNames = (
  customAttributes: string | undefined,
): Set<string> | undefined => {
  const parsedValue = parseTemplateCustomAttributes(customAttributes);
  if (!parsedValue) {
    return undefined;
  }

  try {
    const savedCustomFieldNamesValue = parsedValue[templateCustomAttributesKey];
    const savedCustomFieldNames =
      typeof savedCustomFieldNamesValue === "string"
        ? JSON.parse(savedCustomFieldNamesValue)
        : savedCustomFieldNamesValue;

    if (!Array.isArray(savedCustomFieldNames)) {
      return undefined;
    }

    return new Set(savedCustomFieldNames.map((name) => name.toString()));
  } catch {
    return undefined;
  }
};

const numberReservedAttributeNames = new Set<ReservedAppAttributeName>([
  ReservedAppAttributeName.NODE_COUNT,
  ReservedAppAttributeName.GPU_COUNT,
  ReservedAppAttributeName.CORE_COUNT,
]);

const resourceAttributeNames: ReservedAppAttributeName[] = [
  ReservedAppAttributeName.ACCOUNT,
  ReservedAppAttributeName.PARTITION,
  ReservedAppAttributeName.QOS,
  ReservedAppAttributeName.NODE_COUNT,
  ReservedAppAttributeName.GPU_COUNT,
  ReservedAppAttributeName.CORE_COUNT,
];

const resourceAttributeNamesWithTemplateValues = new Set(resourceAttributeNames);
export const templateResourceAttributesKey = "__scowTemplateResourceAttributes";

export const getHiddenResourceTemplateFieldNames = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
): Set<ReservedAppAttributeName> => {
  return new Set(
    reservedAppAttributes
      ?.filter((attr) => {
        return (
          resourceAttributeNamesWithTemplateValues.has(attr.name) &&
          attr.reservedConfig.type === "fixedValue" &&
          attr.reservedConfig.fixedValue.hidden
        );
      })
      .map((attr) => attr.name) ?? [],
  );
};

export const getVisibleResourceTemplateFieldNames = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
): ReservedAppAttributeName[] => {
  const hiddenResourceFieldNames = getHiddenResourceTemplateFieldNames(reservedAppAttributes);
  return resourceAttributeNames.filter((attributeName) => !hiddenResourceFieldNames.has(attributeName));
};

export const getSavedResourceTemplateFieldNames = (
  customAttributes: string | undefined,
): Set<ReservedAppAttributeName> | undefined => {
  if (!customAttributes) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(customAttributes);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return undefined;
    }

    const savedResourceFieldNamesValue = (parsedValue as Record<string, unknown>)[templateResourceAttributesKey];
    const savedResourceFieldNames =
      typeof savedResourceFieldNamesValue === "string"
        ? JSON.parse(savedResourceFieldNamesValue)
        : savedResourceFieldNamesValue;

    if (!Array.isArray(savedResourceFieldNames)) {
      return undefined;
    }

    return new Set(savedResourceFieldNames as ReservedAppAttributeName[]);
  } catch {
    return undefined;
  }
};

const templateReservedAttributeValueMap: Partial<
  Record<ReservedAppAttributeName, (template: AppTemplateDetail) => unknown>
> = {
  [ReservedAppAttributeName.ACCOUNT]: (template) => template.account,
  [ReservedAppAttributeName.PARTITION]: (template) => template.partition,
  [ReservedAppAttributeName.QOS]: (template) => template.qos,
  [ReservedAppAttributeName.NODE_COUNT]: (template) => template.nodeCount,
  [ReservedAppAttributeName.CORE_COUNT]: (template) => template.coreCount,
  [ReservedAppAttributeName.GPU_COUNT]: (template) => template.gpuCount,
};

const templateFieldNameMap: Partial<Record<ReservedAppAttributeName, string>> = {
  [ReservedAppAttributeName.ACCOUNT]: "account",
  [ReservedAppAttributeName.PARTITION]: "partition",
  [ReservedAppAttributeName.QOS]: "qos",
  [ReservedAppAttributeName.NODE_COUNT]: "nodeCount",
  [ReservedAppAttributeName.CORE_COUNT]: "coreCount",
  [ReservedAppAttributeName.GPU_COUNT]: "gpuCount",
};

const normalizeReservedAttributeValue = (
  value: unknown,
  attributeName: ReservedAppAttributeName,
): string | number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (numberReservedAttributeNames.has(attributeName)) {
    const parsed = typeof value === "number" ? value : parseInt(value.toString(), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return value.toString();
};

export const isTemplateResourceReservedConfigAvailable = (
  template: AppTemplateDetail,
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  currentPartitionIsWithGpu: boolean,
): boolean => {
  const visibleResourceFieldNames = getVisibleResourceTemplateFieldNames(reservedAppAttributes);
  const savedResourceFieldNames = getSavedResourceTemplateFieldNames(template.customAttributes);

  if (!savedResourceFieldNames) {
    return false;
  }

  if (savedResourceFieldNames.size !== visibleResourceFieldNames.length) {
    return false;
  }

  if (visibleResourceFieldNames.some((attributeName) => !savedResourceFieldNames.has(attributeName))) {
    return false;
  }

  return visibleResourceFieldNames.every((attributeName) => {
    if (!currentPartitionIsWithGpu && attributeName === ReservedAppAttributeName.GPU_COUNT) {
      return true;
    }

    if (currentPartitionIsWithGpu && attributeName === ReservedAppAttributeName.CORE_COUNT) {
      return true;
    }

    const reservedConfig = getReservedAppAttributeConfig(reservedAppAttributes, attributeName);
    if (!reservedConfig || reservedConfig.type === "commandSelect") {
      return true;
    }

    const getTemplateValue = templateReservedAttributeValueMap[attributeName];
    if (!getTemplateValue) {
      return true;
    }

    const templateValue = normalizeReservedAttributeValue(getTemplateValue(template), attributeName);
    if (templateValue === undefined) {
      return false;
    }

    if (reservedConfig.type === "fixedValue") {
      const fixedValue = normalizeReservedAttributeValue(reservedConfig.fixedValue.value, attributeName);
      return templateValue === fixedValue;
    }

    const availableValues = reservedConfig.select
      .filter((option) => !option.requireGpu || (option.requireGpu && currentPartitionIsWithGpu))
      .map((option) => normalizeReservedAttributeValue(option.value, attributeName));
    return availableValues.includes(templateValue);
  });
};

export const getReservedAppAttributeConfig = (
  attributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): FixedValueConfig | SelectConfig | CommandSelectReservedConfig | undefined => {
  return attributes?.find((x) => x.name === attributeName)?.reservedConfig;
};

export const normalizeResourceValuesByReservedConfig = <T extends Record<string, any>>(
  values: T,
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
): T => {
  const normalizedValues = { ...values };

  resourceAttributeNames.forEach((attributeName) => {
    const reservedConfig = getReservedAppAttributeConfig(reservedAppAttributes, attributeName);
    if (reservedConfig?.type !== "fixedValue") {
      return;
    }

    const fixedValue = normalizeReservedAttributeValue(reservedConfig.fixedValue.value, attributeName);
    if (fixedValue === undefined) {
      return;
    }

    normalizedValues[templateFieldNameMap[attributeName] as keyof T] = fixedValue as T[keyof T];
  });

  return normalizedValues;
};
