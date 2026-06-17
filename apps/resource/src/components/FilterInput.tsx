"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { styled } from "styled-components";

export const FilterInput = styled(Input)`
  &&.ant-input,
  &&.ant-input-affix-wrapper {
    background-color: ${({ theme }) => theme.token.colorBgContainer} !important;
    border-color: ${({ theme }) => theme.token.colorBorder} !important;
    color: ${({ theme }) => theme.token.colorText};
  }

  &&.ant-input-affix-wrapper .ant-input {
    background-color: transparent;
    color: ${({ theme }) => theme.token.colorText};
  }

  &&.ant-input::placeholder,
  &&.ant-input-affix-wrapper .ant-input::placeholder {
    color: ${({ theme }) => theme.token.colorTextPlaceholder};
  }

  &&.ant-input-affix-wrapper .ant-input-clear-icon {
    color: ${({ theme }) => theme.token.colorTextQuaternary};
  }
`;
