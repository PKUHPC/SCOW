import { Input, InputNumber, type InputNumberProps } from "antd";
import type { ComponentType } from "react";
import { styled } from "styled-components";

import { TrimInput } from "./TrimInput";

export const RoundedInput = styled(TrimInput)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 8px;
  flex: 1;
  width: 100%;
  height: 42px;
  box-shadow: none !important;

  .ant-input {
    border-radius: 8px !important;
  }

  .ant-input,
  .ant-input::placeholder,
  &::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }
`;

export const RoundedPasswordInput = styled(Input.Password)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 8px;
  flex: 1;
  width: 100%;
  height: 42px;
  box-shadow: none !important;

  .ant-input {
    border-radius: 8px !important;
  }

  .ant-input::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }
`;

export const RoundedInputNumber: ComponentType<InputNumberProps> = styled(InputNumber)`
  font-size: 14px !important;
  font-weight: lighter;
  border-radius: 8px;
  flex: 1;
  height: 42px;
  box-shadow: none !important;

  .ant-input-number-input::placeholder {
    color: rgba(136, 143, 163, 1) !important;
    opacity: 1 !important;
  }
`;
