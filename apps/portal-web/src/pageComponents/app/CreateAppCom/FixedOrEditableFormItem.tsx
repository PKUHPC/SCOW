import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Select } from "antd";
import { NamePath } from "antd/es/form/interface";
import { FormInstance } from "antd/lib";
import { useEffect } from "react";
import {
  CommandSelectReservedConfig,
  FixedValueConfig,
  SelectConfig,
  SelectConfigOption,
  SelectOption,
} from "src/pages/api/app/getAppMetadata";
import { formatMinutesToI18nDayHours, TransType } from "src/utils/format";

import { CommandSelect } from "../CommandSelect";

export interface AppResourceFormValues {
  account: string;
  cluster: string;
  partition: string;
  qos: string;
  nodeCount: number;
  gpuCores?: number;
  cpuCores?: number;
  maxTime: number;
  coreCount: number;
  appJobName: string;
  gpuCount: number;
}

interface FixedOrEditableFormItemProps {
  form: FormInstance;
  languageId: string;
  t: TransType;
  name: string;
  label: string | React.ReactNode;
  rules?: object[];
  dependencies?: NamePath[];
  reservedConfig?: FixedValueConfig | SelectConfig | CommandSelectReservedConfig;
  children: React.ReactNode;
  isNumberAttribute?: boolean;
  ignoreDependenciesWhenFixed?: boolean;
  currentPartitionIsWithGpu?: boolean;
  onChange?: ((value: string) => void) | undefined;
  appId?: string;
  clusterId?: string;
}

function ensureNumberValue(value: string | number): number {
  if (typeof value === "number") {
    return value;
  } else {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}

// 判断选项类型的默认初始值是默认值还是选项的默认第一项
export const getSelectAttributeInitalValue = (
  defaultValue: string | number | undefined,
  selectOptions: SelectOption[] | SelectConfigOption[],
): string | number | undefined => {
  if (defaultValue && selectOptions?.some((option) => option.value === defaultValue)) {
    return defaultValue;
  } else {
    return selectOptions?.[0].value ?? undefined;
  }
};

/**
 * 渲染系统保留字段使用的组件
 * 1.如果没有配置，则按原始逻辑可编辑样式
 * 1.如果配置为fixedValue形式，显示固定值判断是否隐藏
 * 2.如果配置为select选项形式，显示下拉框
 */
export const FixedOrEditableFormItem: React.FC<FixedOrEditableFormItemProps> = ({
  form,
  languageId,
  t,
  name,
  label,
  rules,
  dependencies,
  reservedConfig,
  children,
  isNumberAttribute,
  ignoreDependenciesWhenFixed,
  currentPartitionIsWithGpu,
  onChange,
  appId,
  clusterId,
}) => {
  // 当系统保留字段被配置为固定值时，直接渲染固定值
  if (reservedConfig?.type === "fixedValue" && reservedConfig?.fixedValue?.value !== undefined) {
    const value = isNumberAttribute
      ? ensureNumberValue(reservedConfig.fixedValue.value)
      : reservedConfig.fixedValue.value;

    useEffect(() => {
      const currentValue = form.getFieldValue(name);
      // 保证固定值被写入
      if (currentValue !== value) {
        form.setFieldsValue({ [name]: value });
      }
      form.validateFields([name]);
    }, [value]);

    return (
      <InlineFormItem
        name={name}
        label={<FormLabel>{label}</FormLabel>}
        rules={rules}
        hidden={reservedConfig.fixedValue.hidden}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        <div>
          {name === "maxTime"
            ? formatMinutesToI18nDayHours(typeof value === "string" ? parseInt(value, 10) : value, t)
            : reservedConfig.fixedValue.value}
        </div>
      </InlineFormItem>
    );
    // 当系统保留字段被配置为下拉框选项时
  } else if (reservedConfig?.type === "select") {
    // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
    const selectOptions = reservedConfig?.select.filter(
      (x) => !x.requireGpu || (x.requireGpu && currentPartitionIsWithGpu),
    );

    // 使用单个useEffect处理所有逻辑
    useEffect(() => {
      const selectInitialValue = getSelectAttributeInitalValue(reservedConfig.defaultValue, reservedConfig.select);
      const initialFormValue = selectInitialValue
        ? isNumberAttribute
          ? ensureNumberValue(selectInitialValue)
          : selectInitialValue
        : undefined;

      // 判断是否配置了requireGpu选项
      const hasRequireGpuOption = reservedConfig?.select.some((i) => i.requireGpu !== undefined);
      // 获取当前值并确保类型一致
      const currentValue = form.getFieldValue(name);

      // 检查当前值是否在可选项中
      const isValueInOptions =
        currentValue &&
        selectOptions.some((option) => {
          const optionValue = isNumberAttribute ? ensureNumberValue(option.value) : option.value;
          return optionValue === currentValue;
        });

      // 需要设置新值的情况：
      // 1. 当前值不存在
      // 2. 当前值不在可选项列表中
      // 3. 有requireGpu配置且当前值不在筛选后的选项中
      const needsNewValue =
        !currentValue ||
        !isValueInOptions ||
        (currentPartitionIsWithGpu &&
          hasRequireGpuOption &&
          !selectOptions.some((o) => {
            const optionValue = isNumberAttribute ? ensureNumberValue(o.value) : o.value;
            return optionValue === currentValue;
          }));

      if (needsNewValue) {
        form.setFieldsValue({ [name]: initialFormValue });
      }

      // 无论如何都进行验证
      form.validateFields([name]);
    });

    const getAttributeElement = (): JSX.Element => {
      return (
        <Select
          options={selectOptions.map((x) => {
            if (name === "maxTime" && !x.label) {
              return {
                label: formatMinutesToI18nDayHours(ensureNumberValue(x.value), t),
                value: ensureNumberValue(x.value),
              };
            }
            return {
              label: `${x.label ? getI18nConfigCurrentText(x.label, languageId) : x.value}`,
              value: isNumberAttribute ? ensureNumberValue(x.value) : x.value,
            };
          })}
          onChange={onChange}
        />
      );
    };

    return (
      <InlineFormItem
        name={name}
        label={<FormLabel>{label}</FormLabel>}
        rules={rules}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        {getAttributeElement()}
      </InlineFormItem>
    );
  } else if (reservedConfig?.type === "commandSelect") {
    return (
      <InlineFormItem
        name={name}
        label={<FormLabel>{label}</FormLabel>}
        rules={rules}
        dependencies={ignoreDependenciesWhenFixed ? undefined : dependencies}
      >
        <CommandSelect
          label={<FormLabel>{label}</FormLabel>}
          appId={appId!}
          clusterId={clusterId!}
          attributeName={name}
          onChange={onChange}
        />
      </InlineFormItem>
    );
  }

  // 没有特殊保留配置时，渲染 InlineFormItem 和动态子组件
  return (
    <InlineFormItem name={name} label={<FormLabel>{label}</FormLabel>} rules={rules} dependencies={dependencies}>
      {children}
    </InlineFormItem>
  );
};
