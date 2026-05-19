import { styled } from "styled-components";

export const NotifContainer = styled.div`
  height: 100%;
  .ant-card .ant-card-body {
    padding: 12px 24px !important;
  }
`;

export const NotifTitle = styled.div`
  font-size: 14px;
  margin: 0;
  color: ${({ theme }) => theme.token.colorText};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
