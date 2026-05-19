"use client";

import { styled } from "styled-components";

export const FilterFormContainer = styled.div`
  padding: 8px 16px 16px 16px;
  margin: 8px 0;
  background: ${({ theme }) => {
    return theme.token.colorBgElevated;
  }};
  border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;

  .ant-form-item {
    margin: 4px;
    max-width: 100%;
    color: ${({ theme }) => theme.token.colorPrimary};
  }
`;
