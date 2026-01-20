import { Form, type FormInstance } from "antd";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { createK8sNameValidator } from "src/utils/form";

import { Label, RoundedInput } from "../LaunchTrainForm.styles";
import type { BaseFormValues } from "../LaunchTrainForm.types";

const p = prefix("app.jobs.baseInfoSection.");

interface BaseInfoSectionProps {
  form: FormInstance<BaseFormValues>;
  jobName: string;
  onJobNameChange: (value: string) => void;
}

export const BaseInfoSection = ({ form, jobName, onJobNameChange }: BaseInfoSectionProps) => {
  const t = useI18nTranslateToString();

  return (
    <Form
      form={form}
      colon={false}
      requiredMark={false}
      initialValues={{ appJobName: jobName }}
    >
      <InlineFormItem
        name="appJobName"
        label={<Label>{t(p("jobNameLabel"))}</Label>}
        helpTip={t(p("jobNameHelp"))}
        rules={[
          { required: true, message: t(p("jobNameRequired")) },
          createK8sNameValidator(t(p("jobNameRule"))),
        ]}
      >
        <RoundedInput
          size="large"
          value={jobName}
          onChange={(event) => onJobNameChange(event.target.value)}
        />
      </InlineFormItem>
    </Form>
  );
};
