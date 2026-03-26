import styled from "styled-components";

export const FixedFooter = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  padding: 10.5px 32px;
  margin-top: 12px;
  background: ${({ theme }) => theme.token.colorBgContainer};
  border-top: 1px solid ${({ theme }) => theme.token.colorSplit};
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
  z-index: 5;
`;

export const FooterStats = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  color: ${({ theme }) => theme.palette.gray[8]};
  font-size: 13px;
  margin-right: 12px;

  span {
    position: relative;
    white-space: nowrap;
    padding-left: 12px;
  }

  span:first-child {
    padding-left: 0;
  }

  span + span::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 50%;
    width: 4px;
    height: 4px;
    background: ${({ theme }) => theme.token.colorSplit};
    border-radius: 50%;
    transform: translateY(-50%);
  }
`;

export const FooterStatValue = styled.span<{ $isPrimaryColor?: boolean }>`
  color: ${({ theme, $isPrimaryColor }) =>
    $isPrimaryColor ? theme.token.colorPrimary : theme.palette.gray[8]};
`;

export const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;
