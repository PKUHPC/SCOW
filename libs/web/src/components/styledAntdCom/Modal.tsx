"use client";
import { Modal } from "antd";
import { css, styled } from "styled-components";

import { createModalButton } from "../profile/ModalLink";
import { RoundedButton, type RoundedButtonProps } from "./Button";
import { InlineFormItem } from "./CustomFormItem";

const modalBaseStyles = css`
  .ant-modal-content {
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    height: 100%; /* 撑满父容器高度 */
    overflow: hidden; /* 防止内容溢出 */
  }

  .ant-modal-close {
    color: ${(props) => props.theme.token.colorPrimary};
    margin-top: 8px;
  }

  .ant-modal-close:hover {
    color: ${(props) => props.theme.token.colorPrimary};
    background: transparent;
  }

  .ant-modal-header {
    position: relative;
    padding-bottom: 16px;
    margin-bottom: 0;
  }

  .ant-modal-header::after {
    content: "";
    position: absolute;
    left: -24px;
    right: -24px;
    bottom: 0;
    border-bottom: 1px solid var(--ant-color-split, rgba(0, 0, 0, 0.06));
  }

  .ant-modal-body {
    padding-top: 24px;
    flex: 1; /* 占满剩余空间 */
    min-height: 0; /* flex 子元素必须设置，否则不收缩 */
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 交给内部自己滚动 */
  }

  .ant-modal-footer .ant-btn-default {
    color: ${(props) => props.theme.palette.gray[6]};
    border-radius: 8px;
    height: 36px;
    padding: 0 24px;
  }

  .ant-modal-footer .ant-btn-primary {
    border-radius: 8px;
    box-shadow: none;
    height: 36px;
    padding: 0 24px;
  }
`;

export const StyledModal = styled(Modal)`
  ${modalBaseStyles}
`;

// 由于 Next.js App Router 默认的样式注入机制（CSS-in-JS 兼容性）
// 与 Page Router 不同，或者是 Ant Design 的全局样式重置（Reset CSS） 在 App Router 下生效范围不同
// 单独定义 AppRouter 下的 StyledModal 以确保样式正确应用，避免全局样式冲突
export const AppRouterStyledModal = styled(Modal)`
  /* 使用 && 提升 CSS 权重，确保在 App Router 下能盖住 Antd 的默认样式 */
  && {
    ${modalBaseStyles}

    /* App Router 下 Antd 可能会在 body 里多渲染一层包裹器 div */
    /* 让这个包裹器也继承 flex，否则高度就会塌陷 */
    .ant-modal-body > div {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .ant-form-item-row {
    }

    .ant-form-item-label {
      display: flex;
    }

    .ant-form-item-label > label {
      height: 42px;
    }
  }
`;

export const CompactInlineFormItem = styled(InlineFormItem)`
  .ant-form-item-row {
    gap: 6px;
  }

  .ant-form-item-label {
    width: 72px;
  }
`;

export const RoundedModalButton = createModalButton<RoundedButtonProps>(RoundedButton);
