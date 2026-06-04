import type { FormInstance, FormItemProps, Rule } from "antd/es/form";

import { Form } from "antd";
import React, { ReactNode, useMemo } from "react";
import { QuestionMarkIcon } from "src/icons/commonIcons";
import { styled } from "styled-components";

import { Tooltip } from "./Tooltip";

/**
 * 类型守卫：区分规则是“对象”还是“函数”
 * 这里避免使用宽泛的 `Function`，因此用 Extract<Rule, object>。
 */
function isRuleObject(rule: Rule): rule is Extract<Rule, object> {
  return typeof rule !== "function";
}

/**
 * LabelWithHelp：渲染 label → 星号 → 问号
 */
const LabelWithHelp: React.FC<{
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
}> = ({ label, required, help }) => (
  <>
    {label}
    {required && <span style={{ color: "red", marginLeft: 4 }}>*</span>}
    {help && <CommonHelpTipWithQuestionMark title={help} />}
  </>
);

export const CommonHelpTipWithQuestionMark: React.FC<{
  title: ReactNode;
}> = ({ title }) => {
  if (!title) return null;

  return (
    <Tooltip title={title} arrow={false} align={{ offset: [0, -12] }}>
      <QuestionMarkIcon style={{ marginLeft: 6, color: "#999", fontSize: 16 }} />
    </Tooltip>
  );
};

/**
 * CustomFormItem：封装 Form.Item
 * - 自动识别 rules 中是否有 required（支持 RuleObject 与 RuleRender）
 * - 固定顺序为：label → 星号 → 问号
 */
export const CustomFormItem: React.FC<FormItemProps & { helpTip?: ReactNode }> = ({
  label,
  rules,
  helpTip,
  ...rest
}) => {
  // 关键：这里直接拿到 Form 上下文实例（不会是 undefined）
  const form: FormInstance = Form.useFormInstance();

  const isRequired = useMemo(() => {
    if (!rules) return false;
    const arr: Rule[] = Array.isArray(rules) ? rules : [rules];

    return arr.some((r) => {
      if (isRuleObject(r)) {
        // r 为对象规则时，直接读取 required
        // （此处不强求具体类型名，避免引入 rc-field-form 的 RuleObject）
        return !!(r as any).required;
      }
      // r 为函数（RuleRender）：调用它得到对象规则再判断
      try {
        const ro = (r as (form: FormInstance) => any)(form);
        return !!ro?.required;
      } catch {
        return false;
      }
    });
  }, [rules, form]);

  return (
    <Form.Item {...rest} label={<LabelWithHelp label={label} required={isRequired} help={helpTip} />} rules={rules} />
  );
};

export const InlineFormItem = styled(CustomFormItem)<{ $labelWidth?: number }>`
  .ant-form-item-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
  }

  .ant-form-item-label {
    width: ${({ $labelWidth = 131 }) => $labelWidth}px;
    display: flex;
    align-items: center;
    min-height: 40px;
    padding: 0;
    text-align: left;
  }

  .ant-form-item-label > label {
    white-space: normal;
    height: auto;
  }

  .ant-form-item-control {
    flex: 1;
  }
`;
