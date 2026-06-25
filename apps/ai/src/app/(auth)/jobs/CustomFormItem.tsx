import { InlineFormItem as BaseInlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { styled } from "styled-components";

export { CustomFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";

export const INLINE_FORM_LABEL_WIDTH = 121;
export const INFER_INLINE_FORM_LABEL_WIDTH = 147;

export const InlineFormItem = styled(BaseInlineFormItem).attrs<{ $labelWidth?: number }>((props) => ({
  $labelWidth: props.$labelWidth ?? INLINE_FORM_LABEL_WIDTH,
}))``;

// 调整 label 与 gap的宽度，使文字多的行添加 question mark 时能够一行展示不进行换行
export const InferInlineFormItem = styled(BaseInlineFormItem).attrs<{ $labelWidth?: number }>((props) => ({
  $labelWidth: props.$labelWidth ?? INFER_INLINE_FORM_LABEL_WIDTH,
}))`
  .ant-form-item-row {
    gap: 8px;
  }
`;
