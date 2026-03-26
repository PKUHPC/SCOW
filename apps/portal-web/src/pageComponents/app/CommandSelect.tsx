import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Select } from "antd";
import { useCallback, useEffect, useMemo } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";

const p = prefix("pageComp.app.launchAppForm.");

export interface CommandSelectProps {
  label: string | React.ReactNode;
  appId: string;
  clusterId: string;
  attributeName: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  value?: string | number;
}

export const CommandSelect: React.FC<CommandSelectProps> = ({
  label, appId, clusterId, attributeName, placeholder, onChange, value,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const { data, error, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      return api.getDynamicFormOptions({
        query: {
          appId,
          cluster: clusterId,
          attributeName,
        },
      }).httpError(404, () => {
        message.error(t("pages.common.appNotFound", [appId]));
      }).httpError(500, () => {
        message.error(t("pageComp.app.launchAppForm.dynamicOptionError", [label]));
      });
    }, [appId, clusterId, attributeName]),
  });

  // Use provided placeholder or fallback to default
  const i18nPlaceholder = placeholder ?? t(p("dynamicOptionPlaceholder"));

  const options = useMemo(() => data?.options.map((opt) => ({
    label: getI18nConfigCurrentText(opt.label, languageId),
    value: opt.value,
  })), [data, languageId]);

  useEffect(() => {
    if (!isLoading && options && options.length > 0) {
      const currentValue = value?.toString();
      const isValueValid = currentValue !== undefined && currentValue !== null && currentValue !== "" &&
        options.some((o) => o.value === currentValue);

      if (!isValueValid) {
        onChange?.(options[0].value);
      }
    }
  }, [isLoading, options, value, onChange]);

  if (error || (!isLoading && !data)) {
    return (
      <Input
        placeholder={i18nPlaceholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  }

  return (
    <Select
      loading={isLoading}
      placeholder={i18nPlaceholder}
      options={options}
      value={isLoading ? undefined : value?.toString()}
      onChange={onChange}
    />
  );
};
