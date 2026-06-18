import { styled } from "styled-components";

export const ModalContentWrapper = styled.div`
  display: grid;
  grid-template-columns: 242px 1fr;
  grid-template-rows: minmax(440px, 1fr);
  width: 100%;
  font-size: 14px;
`;

export const TemplateListPanel = styled.div`
  background-color: ${({ theme }) => theme.palette.gray[2]};
  border-radius: 12px;
  margin: 24px 0 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
`;

export const TemplateRightColumn = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const ModalFooterArea = styled.div`
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 16px 0 0;
  gap: 16px;

  .ant-btn-default {
    border-color: ${({ theme }) => theme.palette.gray[3]};
    color: ${({ theme }) => theme.palette.gray[6]};
    border-radius: 4px;
    height: 36px;
    padding: 0 24px;
  }

  .ant-btn-primary {
    border-radius: 4px;
    box-shadow: none;
    height: 36px;
    padding: 0 24px;
  }
`;

export const TemplateListContainer = styled.div<{ $maxHeight: number }>`
  width: 100%;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const TemplateListItem = styled.div<{
  $selected: boolean;
  $hovered: boolean;
  $selectedColor: string;
}>`
  min-height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 0 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${({ $selected, $selectedColor, theme }) => ($selected ? $selectedColor : theme.palette.gray[6])};
  background: ${({ $hovered, theme }) => ($hovered ? theme.palette.gray[3] : "transparent")};
  font-size: 14px;
  cursor: pointer;
  user-select: none;
`;

export const TemplateDetailPanel = styled.div`
  flex: 1;
  min-width: 0;
  padding: 40px 0 0 48px;
  display: flex;
`;

export const TemplateEmptyState = styled.div`
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

export const DeleteConfirmText = styled.div<{ $color: string }>`
  font-size: 14px;
  color: ${({ $color }) => $color};
`;

export const TemplateNameText = styled.span`
  flex: 1;
  text-align: left;
  color: inherit;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
