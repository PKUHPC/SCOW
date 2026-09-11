import styled from "styled-components";

/** 文件管理页面顶部固定元素（导航栏 + 页面标题）占用的高度，用于计算文件管理器可用视口高度 */
export const FILE_MANAGER_TOP_OFFSET_PX = 107;
/** 文件管理页面文件列表表格 scroll.y 值，用于触发 Ant Design 虚拟滚动；实际可用高度由外层 flex 布局决定 */
export const FILE_TABLE_SCROLL_Y = 507;

export const TopCard = styled.div`
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer};
  padding: 24px 24px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const SelectPreFix = styled.span`
  width: 65px;
  display: flex;
  align-items: center;
  white-space: nowrap;
`;

export const UpButtonBox = styled.div<{ $disabled?: boolean }>`
  display: inline-flex;
  height: 36px;
  padding: 0 12px;
  margin: 0 8px;
  align-self: center;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  flex-shrink: 0;

  /* hover：非禁用时显示主题色边框 */
  &:not([data-disabled="true"]):hover {
    border-color: ${({ theme }) => theme.token.colorPrimary};
    color: ${({ theme }) => theme.token.colorPrimary};
  }

  /* 点击/focus：边框 + 外发光 */
  &:not([data-disabled="true"]):active,
  &:not([data-disabled="true"]):focus {
    border-color: ${({ theme }) => theme.token.colorPrimary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.token.colorPrimary}33;
  }
`;

export const TopBar = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;

  .ant-select-selector {
    border-radius: 4px !important;
  }

  & > button {
    margin: 0px 4px;
  }

  .ant-btn {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
`;

export const OperationBar = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 8px;

  .ant-btn {
    border-radius: 4px !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
`;

export const StorageInfoSection = styled.div`
  padding: 0 20px 16px;
  width: 100%;
  box-sizing: border-box;
`;
