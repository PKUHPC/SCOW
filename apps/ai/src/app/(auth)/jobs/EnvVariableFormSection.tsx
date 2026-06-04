import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { EnvironmentVariableList } from "src/app/(auth)/jobs/EnvironmentVariableList";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { RESERVED_ENV_KEYS, RESOURCE_ENV_KEYS } from "src/models/envVars";

const p = prefix("app.jobs.appConfigSection.");

interface EnvVariableFormSectionProps {
  clusterId?: string;
  homeDir?: string;
}

export const EnvVariableFormSection = ({ clusterId, homeDir }: EnvVariableFormSectionProps) => {
  const t = useI18nTranslateToString();
  const allKeys = [...RESERVED_ENV_KEYS, ...RESOURCE_ENV_KEYS];

  return (
    <InlineFormItem
      label={<Label>{t(p("environmentVariables.label"))}</Label>}
      helpTip={<>{t(p("environmentVariables.extraTip"), [allKeys.join(", ")])}</>}
    >
      <EnvironmentVariableList clusterId={clusterId} homeDir={homeDir} />
    </InlineFormItem>
  );
};
