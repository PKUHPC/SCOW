import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { CompactInlineFormItem, StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import {
  createNonEmptyValidator as createJobNameValidator,
  createNonEmptyValidator,
} from "@scow/lib-web/build/utils/form";
import { Form } from "antd";
import React, { useState } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";

export interface SaveAsTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (templateName: string) => Promise<void>;
}

interface SaveAsTemplateFormValues {
  templateName: string;
}

const p = prefix("pageComp.job.submitJobForm.");
const pBaseInfo = prefix("pageComp.submitJobCom.baseInfoSection.");

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({ open, onClose, onSave }) => {
  const [form] = Form.useForm<SaveAsTemplateFormValues>();
  const [loading, setLoading] = useState(false);
  const t = useI18nTranslateToString();

  const handleSubmit = async ({ templateName }: SaveAsTemplateFormValues) => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      return;
    }
    setLoading(true);
    try {
      await onSave(trimmedName);
      onClose();
      form.resetFields();
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledModal
      open={open}
      title={t(p("saveToTemplate"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      closable={false}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={form.submit}
      getContainer={false}
    >
      <Form form={form} onFinish={handleSubmit} requiredMark={false} colon={false}>
        <CompactInlineFormItem
          label={<FormLabel>{t(p("templateNameLabel"))}</FormLabel>}
          name="templateName"
          rules={[
            createNonEmptyValidator(t(p("templateNameRequired"))),
            createJobNameValidator(t(pBaseInfo("jobNameRule"))),
          ]}
        >
          <RoundedInput />
        </CompactInlineFormItem>
      </Form>
    </StyledModal>
  );
};
