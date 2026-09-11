import { css, styled } from "styled-components";

/**
 * Shared layout primitives for file/folder selector modals.
 * Used by portal-web job FileSelectModal, filemanager AdvancedFileSelectModal,
 * and ai FileSelectModal to ensure consistent appearance.
 */

export const fileSelectModalStyles = css`
  .ant-modal-body {
    overflow: visible;
  }

  .ant-btn {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  @media (max-width: 640px) {
    width: min(360px, calc(100vw - 32px)) !important;

    .ant-modal-footer > div {
      overflow-x: auto;
    }

    .ant-modal-footer > div > div {
      flex-shrink: 0;
    }
  }
`;

export const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

export const ModalPathBarRow = styled.div`
  margin-bottom: 16px;

  & > div > div,
  & > div > button {
    border-color: ${({ theme }) => theme.palette.gray[4]} !important;
  }
`;

export const ModalContent = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding-bottom: 2px;
  box-sizing: border-box;

  @media (max-width: 640px) {
    gap: 0;
  }
`;

export const ModalSidebarCard = styled.div`
  width: 240px;
  min-width: 240px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer};
  overflow-y: auto;

  @media (max-width: 640px) {
    width: 100%;
    min-width: 0;
  }
`;

interface ModalSidebarEntryProps {
  $selected?: boolean;
}

export const ModalSidebarEntry = styled.div<ModalSidebarEntryProps>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  background: transparent;
  color: ${({ $selected, theme }) => ($selected ? theme.token.colorPrimary : "inherit")};
  font-weight: normal;

  &:hover {
    background: ${({ theme }) => theme.token.colorFillTertiary};
  }
`;

// @media (max-width: 640px) {
//   flex-direction: column;
// }

export const ModalFileListCard = styled.div`
  position: relative;
  flex: 0 1 666px;
  width: min(666px, 100%);
  height: min(386px, 100%);
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};

  .ant-table-wrapper,
  .ant-spin-nested-loading,
  .ant-spin-container,
  .ant-table,
  .ant-table-container {
    flex: 1 !important;
    min-height: 0 !important;
    display: flex;
    flex-direction: column;
  }

  .ant-table-thead > tr > th {
    height: 56px !important;
  }

  .ant-table-wrapper .ant-table-body,
  .ant-table-wrapper .ant-table-content {
    flex: 1 !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: auto !important;
    overflow-x: auto !important;
    scrollbar-gutter: auto;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.token.colorBorder};
      border-radius: 4px;
    }
  }

  /* scroll.y 只控制滚动视口，表格本身必须按内容高度排版，避免平均拉伸数据行 */
  .ant-table-body > table,
  .ant-table-content > table {
    height: auto !important;
    min-height: 0 !important;
  }

  .ant-table-tbody > tr:not(.ant-table-measure-row) {
    height: 50px !important;
  }

  .ant-table-tbody > tr:not(.ant-table-measure-row) > td.ant-table-cell {
    height: 50px !important;
    min-height: 50px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    border-bottom-color: ${({ theme }) => theme.token.colorBorderSecondary} !important;
  }

  .ant-table-container {
    overflow: hidden !important;
  }

  .ant-table.ant-table-empty .ant-table-body > table,
  .ant-table.ant-table-empty .ant-table-content > table {
    height: 100% !important;
    min-height: 100% !important;
  }

  .ant-table.ant-table-empty .ant-table-measure-row {
    display: none !important;
  }

  .ant-table.ant-table-empty .ant-table-placeholder > td {
    height: 100% !important;
    vertical-align: middle;
    border-bottom: none !important;
  }
`;
