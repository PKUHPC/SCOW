"use client";

import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { CompactInlineFormItem, AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { createNonEmptyValidator } from "@scow/lib-web/build/utils/form";
import { App, Form } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { JobType } from "src/models/Job";
import { type SaveTemplateInput, type TemplateFormData } from "src/server/trpc/route/jobs/templates";
import { trpc } from "src/utils/trpc";

export interface SaveAsTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  jobType: JobType;
  appId?: string;
  cluster: string;
  formData: TemplateFormData | null;
}

interface SaveAsTemplateFormValues {
  templateName: string;
}

const p = prefix("app.jobs.saveAsTemplateModal.");

export const SaveAsTemplateModal = ({
  open,
  onClose,
  onSuccess,
  jobType,
  appId,
  cluster,
  formData,
}: SaveAsTemplateModalProps) => {
  const t = useI18nTranslateToString();
  const { message } = App.useApp();
  const [form] = Form.useForm<SaveAsTemplateFormValues>();

  const mutation = trpc.jobs.saveTemplate.useMutation({
    onSuccess: () => {
      message.success(t(p("saveSuccessfully")));
      form.resetFields();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        form.setFields([{ name: "templateName", errors: [t(p("nameConflict"))] }]);
      } else {
        message.error(t(p("saveFailed"), [err.message]));
      }
    },
  });

  const handleSubmit = ({ templateName }: SaveAsTemplateFormValues) => {
    const trimmed = templateName.trim();
    if (!trimmed || !formData) return;
    mutation.mutate({
      templateName: trimmed,
      jobType,
      appId,
      cluster,
      formData,
    } as SaveTemplateInput);
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <AppRouterStyledModal
      open={open}
      title={t(p("title"))}
      okText={t(p("save"))}
      cancelText={t(p("cancel"))}
      closable={false}
      onCancel={handleCancel}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
      getContainer={false}
    >
      <Form form={form} onFinish={handleSubmit} requiredMark={false} colon={false}>
        <CompactInlineFormItem
          label={<FormLabel>{t(p("nameLabel"))}</FormLabel>}
          name="templateName"
          rules={[createNonEmptyValidator(t(p("nameRequired"))), { max: 100, message: t(p("nameTooLong")) }]}
        >
          <RoundedInput placeholder={t(p("namePlaceholder"))} />
        </CompactInlineFormItem>
      </Form>
    </AppRouterStyledModal>
  );
};
