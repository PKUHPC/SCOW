import { styled } from "styled-components";

export const AssetContainer = styled.div`
  padding: 20px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;
  max-height: min(1200px, calc(100vh - 130px));
  overflow-y: auto;

.ant-descriptions-item-label {
  width: 150px !important;
  display: inline-block;
}
`;
