import { InlineFormItem as BaseInlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { styled } from "styled-components";

export { CustomFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";

export const InlineFormItem = styled(BaseInlineFormItem).attrs<{ $labelWidth?: number }>((props) => ({
  $labelWidth: props.$labelWidth ?? 121,
}))``;

export const InferInlineFormItem = styled(BaseInlineFormItem).attrs<{ $labelWidth?: number }>((props) => ({
  $labelWidth: props.$labelWidth ?? 131,
}))``;
