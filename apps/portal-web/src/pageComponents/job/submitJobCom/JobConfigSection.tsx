import { parsePlaceholder } from "@scow/lib-config/build/parse";
import { CommandInputField } from "@scow/lib-web/build/components/codeEditor/CommandInputField";
import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { SectionTitle,TitledSectionCard } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Form, type FormInstance } from "antd";
import { join } from "path";
import { useCallback, useEffect } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileSelectModal } from "src/pageComponents/job/FileSelectModal";
import { Cluster } from "src/utils/cluster";

import { JobFormValues } from "./SubmitJobForm.types";

interface JobConfigSectionProps {
  form: FormInstance<JobFormValues>;
  cluster?: Cluster;
  submitJobPromptText?: string;
  jobName: string;
  output: string;
  errorOutput: string;
  onOutputChange: (value: string) => void;
  onErrorOutputChange: (value: string) => void;
  scriptOutput: string;
  onScriptOutputChange: (value: string) => void;
}

const p = prefix("pageComp.job.submitJobForm.");

export const JobConfigSection = ({
  form,
  cluster,
  submitJobPromptText,
  jobName,
  output,
  errorOutput,
  onOutputChange,
  onErrorOutputChange,
  scriptOutput,
  onScriptOutputChange,
}: JobConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const calculateWorkingDirectory = (template: string, homePath: string = "") =>
    join(homePath + "/",
      parsePlaceholder(template, { name: jobName }));

  const clusterInfoQuery = useAsync({
    promiseFn: useCallback(async () => cluster
      ? api.getClusterInfo({ query: { cluster: cluster.id } })
      : undefined, [cluster?.id]),
  });

  const { data: homePath } = useAsync({
    promiseFn: useCallback(async () => cluster
      ? api.getHomeDirectory({ query: { cluster: cluster.id } })
      : { path: "" }, [cluster?.id]),
  });

  useEffect(() => {
    if (!form.isFieldTouched("workingDirectory") && clusterInfoQuery.data) {
      form.setFieldValue("workingDirectory",
        calculateWorkingDirectory(clusterInfoQuery.data.clusterInfo.submitJobDirTemplate, homePath?.path));
    }
  }, [clusterInfoQuery.data, form, homePath?.path, jobName]);

  return (
    <TitledSectionCard title={<SectionTitle>{t(p("jobConfigSectionTitle"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
        initialValues={{}}
      >
        <InlineFormItem
          name="workingDirectory"
          label={<FormLabel>{t(p("workingDirectory"))}</FormLabel>}
          helpTip={(
            <>
              <span>{t(p("wdTooltip1"))}</span>
              <br />
              <span>{t(p("wdTooltip2"))}</span>
            </>
          )}
          rules={[{ required: true }]}
        >
          <RoundedInput
            size="large"
            style={{ width: "50%" }}
            suffix={cluster ? (
              <FileSelectModal
                onSubmit={(path: string) => {
                  form.setFields([{ name: "workingDirectory", value: path, touched: true }]);
                  form.validateFields(["workingDirectory"]);
                }}
                cluster={cluster}
              />
            ) : undefined}
          />
        </InlineFormItem>

        <InlineFormItem
          name="output"
          label={<FormLabel>{t(p("output"))}</FormLabel>}
          rules={[{ required: true, message: t(p("outputRequired")) }]}
        >
          <RoundedInput
            size="large"
            style={{ width: "50%" }}
            value={output}
            onChange={(event) => onOutputChange(event.target.value)}
          />
        </InlineFormItem>


        <InlineFormItem
          name="errorOutput"
          label={<FormLabel>{t(p("errorOutput"))}</FormLabel>}
          rules={[{ required: true, message: t(p("errorOutputRequired")) }]}
        >
          <RoundedInput
            size="large"
            style={{ width: "50%" }}
            value={errorOutput}
            onChange={(event) => onErrorOutputChange(event.target.value)}
          />
        </InlineFormItem>

        <InlineFormItem
          name="scriptOutput"
          label={<FormLabel>{t(p("scriptOutputLabel"))}</FormLabel>}
          helpTip={t(p("wdTooltip3"))}
          rules={[
            { required: true, message: t(p("scriptOutputRequired")) },
          ]}
        >
          <RoundedInput
            size="large"
            style={{ width: "50%" }}
            value={scriptOutput}
            onChange={(event) => onScriptOutputChange(event.target.value)}
          />
        </InlineFormItem>

        <InlineFormItem
          name="command"
          rules={[{ required: true, message: t(p("commandRequired")) }]}
          label={<FormLabel>{t(p("commandLabel"))}</FormLabel>}
        >
          <CommandInputField placeholder={submitJobPromptText} defaultRows={10} />
        </InlineFormItem>
      </Form>
    </TitledSectionCard>

  );
};
