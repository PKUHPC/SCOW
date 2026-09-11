import { Button } from "antd";
import { styled } from "styled-components";

export const FolderTriggerButton = styled(Button)`
  width: 40px !important;
  height: 24px !important;
  border-radius: 6px !important;
  border-style: none;
  background: ${({ theme }) => theme.token.colorPrimaryBg} !important;
  box-shadow: none !important;
  border-color: transparent !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  margin-inline-end: 16px;

  .anticon {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;

    svg {
      width: 20px !important;
      height: 32px !important;
    }
  }
`;