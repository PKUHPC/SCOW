import { Modal } from "antd";
import { styled } from "styled-components";

import { InlineFormItem } from "./CustomFormItem";

export const StyledModal = styled(Modal)`
  .ant-modal-content {
    border-radius: 12px;
    padding: 24px;
  }

  .ant-modal-close {
    color: ${(props) => props.theme.token.colorPrimary};
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
  }

  .ant-modal-footer .ant-btn-default {
    border-color: ${(props) => props.theme.palette.gray[3]};
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

export const CompactInlineFormItem = styled(InlineFormItem)`
  .ant-form-item-row {
    gap: 6px;
  }

  .ant-form-item-label {
    width: 72px;
  }
`;
