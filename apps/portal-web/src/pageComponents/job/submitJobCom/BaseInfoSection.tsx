import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { createK8sNameValidator as createJobNameValidator } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { BaseFormValues } from "./SubmitJobForm.types";

const p = prefix("pageComp.submitJobCom.baseInfoSection.");

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
      initialValues={{ jobName }}
    >
      <InlineFormItem
        name="jobName"
        label={<FormLabel>{t(p("jobNameLabel"))}</FormLabel>}
        helpTip={t(p("jobNameHelp"))}
        rules={[
          { required: true, message: t(p("jobNameRequired")) },
          createJobNameValidator(t(p("jobNameRule"))),
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
