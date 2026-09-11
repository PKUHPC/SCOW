
import React from "react";
import { EntryPathsCollapseIcon, EntryPathsExpandIcon } from "src/icons/FileIcon";
import { styled } from "styled-components";

/** 外层 flex 容器：接收 style prop（flex:1 等） */
const Outer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  flex: 1;
  min-height: 0;
  padding-bottom: 2px;
  box-sizing: border-box;
  overflow: visible;
`;

const Layout = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer};
`;

const SidebarWrapper = styled.div<{ $width: number }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: ${({ $width }) => $width}px;
  min-width: ${({ $width }) => $width}px;
  border-right: 1px solid ${({ theme }) => theme.palette.gray[4]};
  background: ${({ theme }) => theme.token.colorBgContainer};
  border-radius: 4px 0 0 4px;
`;

const SidebarScrollArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 0 24px 0;
  overflow-y: auto;
  overflow-x: hidden;
`;

interface SidebarEntryProps {
  $selected?: boolean;
  $disabled?: boolean;
}

const SidebarEntry = styled.div<SidebarEntryProps>`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  cursor: ${({ $disabled }) => $disabled ? "not-allowed" : "pointer"};
  pointer-events: ${({ $disabled }) => $disabled ? "none" : "auto"};
  opacity: ${({ $disabled }) => $disabled ? 0.4 : 1};
  border-radius: 8px;
  margin: 2px 8px;
  background: transparent;
  color: ${({ $selected, theme }) =>
    $selected ? theme.token.colorPrimary : "inherit"};
  font-weight: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;

  /* Override IconContainer's forced primary color; suppress its own hover bg */
    & > div {
    color: ${({ $selected, theme }) =>
    $selected ? theme.token.colorPrimary : theme.token.colorText
  };
      &:hover {
      background: transparent;
    }
  }
  &:hover {
    background: ${({ theme }) => theme.token.colorFillTertiary};
  }
`;


/** 收缩按钮：绝对定位在侧边栏右边缘，垂直居中，位于分割线左侧 */
const CollapseButton = styled.div`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  width: 18px;
  height: 48px;
  border-radius: 5px 0 0 5px;
  background: ${({ theme }) => theme.token.colorBorderSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: ${({ theme }) => theme.token.colorTextSecondary};


`;

/** 收缩后展开按钮：悬浮在内容区左边缘，不占用布局空间 */
const ExpandOverlayButton = styled.div`
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 18px;
  height: 48px;
  border-radius: 0 5px 5px 0;
  background: ${({ theme }) => theme.token.colorBorderSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${({ theme }) => theme.token.colorTextSecondary};
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SidebarIconWrapper = styled.div`
  width: 20px;
  min-width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
`;

export interface FileSidebarEntry {
  key: string | number;
  label: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  selected: boolean;
  disabled?: boolean;
}

export interface FileBrowserLayoutProps {
  /** Sidebar entries: home dir + quick path entries */
  entries: FileSidebarEntry[];
  /** Optional bottom section rendered at the bottom of the sidebar (e.g., storage quota) */
  sidebarBottom?: React.ReactNode;
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Called when the collapse strip is clicked */
  onCollapseToggle?: () => void;
  /** The right-side content (file table area) */
  children: React.ReactNode;
  /** Additional inline style applied to the outer layout container */
  style?: React.CSSProperties;
  /** Sidebar width in pixels, default 260 */
  sidebarWidth?: number;
}

/**
 * Shared layout for file browser panels.
 *
 * Renders a collapsible left sidebar (quick paths / home directory entries)
 * alongside a right content area (file table). Both the full-page FileManager
 * and the file-picker modals can use this component; callers supply the entry
 * list and are responsible for navigation logic.
 *
 * Pass `sidebarBottom` to render extra content (e.g., storage quota progress)
 * pinned to the bottom of the sidebar — only the full-page FileManager needs this.
 */
export const FileBrowserLayout: React.FC<FileBrowserLayoutProps> = ({
  entries,
  sidebarBottom,
  collapsed = false,
  onCollapseToggle,
  children,
  style,
  sidebarWidth = 260,
}) => {
  return (
    <Outer style={style}>
      <Layout>
        {!collapsed ? (
          <SidebarWrapper $width={sidebarWidth}>
            <SidebarScrollArea>
              {entries.map((entry) => (
                <SidebarEntry
                  key={entry.key}
                  $selected={entry.selected}
                  $disabled={entry.disabled}
                  onClick={entry.disabled ? undefined : entry.onClick}
                >
                  <SidebarIconWrapper>
                    {entry.icon}
                  </SidebarIconWrapper>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.label}
                  </span>
                </SidebarEntry>
              ))}
            </SidebarScrollArea>

            {sidebarBottom && (
              <div style={{ flexShrink: 0 }}>
                {sidebarBottom}
              </div>
            )}

            {/* 收缩按钮 */}
            {onCollapseToggle && (
              <CollapseButton onClick={onCollapseToggle}>
                <EntryPathsCollapseIcon />
              </CollapseButton>
            )}
          </SidebarWrapper>
        ) : (
          /* 展开按钮：悬浮在内容区左边缘 */
          onCollapseToggle && (
            <ExpandOverlayButton onClick={onCollapseToggle}>
              <EntryPathsExpandIcon />
            </ExpandOverlayButton>
          )
        )}

        <ContentArea>
          {children}
        </ContentArea>
      </Layout>
    </Outer>
  );
};
