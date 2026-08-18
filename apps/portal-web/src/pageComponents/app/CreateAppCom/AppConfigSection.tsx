import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import {
  RoundedInput,
  RoundedInputNumber,
  RoundedPasswordInput,
} from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { SectionTitle, TitledSectionCard } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { createLinuxAbsolutePathValidator } from "@scow/lib-web/build/utils/form";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Form, type FormInstance } from "antd";
import { Rule } from "antd/es/form";
import { useMemo } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppCustomAttribute } from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";

import { AdvancedFileSelectModal } from "../../filemanager/AdvancedFileSelectModal";
import { CommandSelect } from "../CommandSelect";
import { getSelectAttributeInitalValue } from "./FixedOrEditableFormItem";

interface AppConfigSectionProps {
  form: FormInstance;
  languageId: string;
  appId: string;
  clusterId: string;
  attributes: AppCustomAttribute[];
  currentPartitionInfo: Partition | undefined;
}

const p = prefix("pageComp.app.launchAppForm.");

export const AppConfigSection = ({
  form,
  languageId,
  appId,
  clusterId,
  attributes,
  currentPartitionInfo,
}: AppConfigSectionProps) => {
  const t = useI18nTranslateToString();

  const customFormItems = useMemo(
    () =>
      attributes.map((item, index) => {
        const rules: Rule[] =
          item.type === "NUMBER" ? [{ type: "integer" }, { required: item.required }] : [{ required: item.required }];
        if (item.type === "FILE") {
          rules.push(
            createLinuxAbsolutePathValidator({
              unsafeCharacter: t(p("pathUnsafeCharacter")),
              pathTraversal: t(p("pathTraversal")),
              currentDirectory: t(p("pathCurrentDirectory")),
              absoluteRequired: t(p("absolutePathRequired")),
              rootNotAllowed: t(p("rootNotAllowed")),
            }),
          );
        }

        const placeholder = item.placeholder ?? "";

        // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
        const selectOptions = item.select.filter((x) => !x.requireGpu || (x.requireGpu && currentPartitionInfo?.gpus));

        // 当为 SELECT 类型时
        // 如果配置了默认值，但是默认值不存在于select下选项的value中；或者如果没有配置默认值
        // 则默认显示SELECT的第一项
        const initialValue =
          item.type === "SELECT" ? getSelectAttributeInitalValue(item.defaultValue, selectOptions) : item.defaultValue;

        const getAttributeElement = (item: any): JSX.Element => {
          // 如果配置了不可修改的固定值
          if (item.type !== "SELECT" && item.fixedValue?.value !== undefined) {
            const currentValue = form.getFieldValue(item.name);
            const newFormValue = item.type === "NUMBER" ? parseInt(item.fixedValue.value) : item.fixedValue.value;
            // 保证固定值被写入
            if (currentValue !== newFormValue) {
              form.setFieldsValue({ [item.name]: newFormValue });
              form.validateFields([item.name]);
            }

            return <div> {newFormValue} </div>;
          }

          if (item.type === "NUMBER") {
            return <RoundedInputNumber placeholder={getI18nConfigCurrentText(placeholder, languageId)} />;
          } else if (item.type === "TEXT") {
            return <RoundedInput placeholder={getI18nConfigCurrentText(placeholder, languageId)} />;
          } else if (item.type === "SELECT") {
            return (
              <RoundedSelect
                options={selectOptions.map((x) => ({
                  label: getI18nConfigCurrentText(x.label, languageId),
                  value: x.value,
                }))}
                placeholder={getI18nConfigCurrentText(placeholder, languageId)}
              />
            );
          } else if (item.type === "PASSWORD") {
            return <RoundedPasswordInput placeholder={getI18nConfigCurrentText(placeholder, languageId)} />;
          } else if (item.type === "COMMAND_SELECT") {
            return (
              <CommandSelect
                label={<FormLabel>{getI18nConfigCurrentText(item.label, languageId)}</FormLabel>}
                appId={appId}
                clusterId={clusterId}
                attributeName={item.name}
                placeholder={getI18nConfigCurrentText(placeholder, languageId)}
              />
            );
          } else {
            // 如果 item.type === FILE
            return (
              <RoundedInput
                placeholder={item.placeholder}
                prefix={
                  <div style={{ marginRight: "4px" }}>
                    <AdvancedFileSelectModal
                      allowedFileType={["DIR", "FILE"]}
                      onSubmit={(path: string) => {
                        form.setFields([{ name: item.name, value: path, touched: true }]);
                        form.validateFields([item.name]);
                      }}
                      clusterId={clusterId}
                    />
                  </div>
                }
              />
            );
          }
        };

        const inputItem = getAttributeElement(item);

        // 判断是否配置了requireGpu选项
        if (item.type === "SELECT" && item.select.find((i) => i.requireGpu !== undefined)) {
          const preValue = form.getFieldValue(item.name);

          if (preValue) {
            // 切换分区后看之前的版本是否还存在，若不存在，则选择版本的select的值置空
            const optionsContained = selectOptions.find((i) => i.value === preValue);
            if (!optionsContained) form.setFieldValue(item.name, null);
          }
        }

        return (
          <InlineFormItem
            key={`${item.name}+${index}`}
            label={<FormLabel>{getI18nConfigCurrentText(item.label, languageId)}</FormLabel>}
            name={item.name}
            rules={rules}
            initialValue={initialValue}
            hidden={item.fixedValue?.hidden}
          >
            {inputItem}
          </InlineFormItem>
        );
      }),
    [attributes, currentPartitionInfo, languageId],
  );

  return (
    customFormItems.length > 0 && (
      <TitledSectionCard title={<SectionTitle>{t(p("appConfigSectionTitle"))}</SectionTitle>}>
        <Form form={form} colon={false} requiredMark={false}>
          {customFormItems}
        </Form>
      </TitledSectionCard>
    )
  );
};
