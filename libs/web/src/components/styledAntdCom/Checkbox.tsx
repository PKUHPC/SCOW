import type { CheckboxProps } from "antd";
import type { ComponentType } from "react";

import { Checkbox as AntCheckbox } from "antd";
import { styled } from "styled-components";

import { checkIcon as CheckIcon } from "../../icons/commonIcons";

const CheckboxContainer = ({ className, children, ...props }: CheckboxProps & { className?: string }) => (
  <span className={className}>
    <AntCheckbox {...props}>{children}</AntCheckbox>
    <span className="check-overlay" aria-hidden="true">
      <CheckIcon />
    </span>
  </span>
);

export const Checkbox: ComponentType<CheckboxProps> = styled(CheckboxContainer)`
  position: relative;
  display: inline-flex;
  align-items: center;

  .ant-checkbox-inner {
    width: 18px !important;
    height: 18px !important;
    border-radius: 4px !important;
    border: 1px solid ${({ theme }) => theme.palette.gray[3]} !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .ant-checkbox-inner::after {
    display: none !important;
  }

  .ant-checkbox-checked .ant-checkbox-inner {
    opacity: 0 !important;
  }

  .ant-checkbox:hover .ant-checkbox-inner {
    border-color: ${({ theme }) => theme.palette.primary[6]} !important;
  }

  .check-overlay {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    line-height: 0;
  }

  &:has(.ant-checkbox-checked) .check-overlay {
    display: inline-flex;
  }

  &:has(.ant-checkbox-disabled) {
    .ant-checkbox-inner {
      background: ${({ theme }) => theme.palette.gray[1]} !important;
    }

    .check-overlay {
      opacity: 0.5;
    }
  }
`;
