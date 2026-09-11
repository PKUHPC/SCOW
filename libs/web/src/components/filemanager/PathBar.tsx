"use client";

import { RightOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Input } from "antd";
import { useEffect, useState } from "react";
import { styled } from "styled-components";
import { FreshIcon } from "../../icons/FileIcon";

interface Props {
  path: string;
  loading: boolean;
  onPathChange: (path: string) => void;
  breadcrumbItemRender: (pathSegment: string, index: number, path: string) => React.ReactNode;
  prefix?: React.ReactNode;
  /** When true, bar and refresh button are flush/connected (for modal use) */
  compact?: boolean;
  refreshPadding?: number;
}

const Bar = styled.div`
  display: flex;
  width: 100%;
`;

/** compact 模式下地址栏与刷新按钮的固定高度，与输入框 Input.Search 对齐 */
const COMPACT_BAR_HEIGHT = 36;
const BarStateBar = styled(Bar)<{ $compact?: boolean }>`
  border: 1px solid ${({ theme }) => theme.palette.gray[4]};
  border-radius: ${({ $compact }) => ($compact ? "4px 0 0 4px" : "4px")};
  ${({ $compact }) => ($compact ? "border-right: none;" : "")}
  padding: 0 8px;
  margin: ${({ $compact }) => ($compact ? "0" : "0 4px")};
  ${({ $compact }) => ($compact ? `height: ${COMPACT_BAR_HEIGHT}px;` : "")}

  .ant-breadcrumb {
    align-self: center;
  }
`;

const CompactRefreshButton = styled(Button)<{ $showActive?: boolean; $refreshPadding: number }>`
  display: flex !important;
  height: ${COMPACT_BAR_HEIGHT}px !important;
  width: auto !important;
  padding: 0 ${({ $refreshPadding }) => $refreshPadding}px !important;
  justify-content: center !important;
  align-items: center !important;
  border-radius: 0 4px 4px 0 !important;
  background: ${({ theme }) => theme.token.colorBgContainer} !important;
  flex-shrink: 0;
  outline: none !important;

  /* $showActive 驱动所有主题色状态 */
  border: 1px solid ${({ theme, $showActive }) => ($showActive ? theme.token.colorPrimary : theme.palette.gray[4])} !important;
  color: ${({ theme, $showActive }) => ($showActive ? theme.token.colorPrimary : theme.palette.gray[6])} !important;
  box-shadow: ${({ theme, $showActive }) =>
    $showActive ? `0 0 0 2px ${theme.token.colorPrimary}33` : "none"} !important;

  &:not(:disabled):hover {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none !important;
  }

  &:active {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.token.colorPrimary}33 !important;
  }

  &:focus-visible {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.token.colorPrimary}33 !important;
  }
`;

const RefreshButton = styled(Button)<{ $showActive?: boolean; $refreshPadding: number }>`
  padding-left: ${({ $refreshPadding }) => $refreshPadding}px !important;
  padding-right: ${({ $refreshPadding }) => $refreshPadding}px !important;
  border: 1px solid ${({ theme, $showActive }) => ($showActive ? theme.token.colorPrimary : theme.palette.gray[4])} !important;
  border-radius: 4px !important;
  outline: none !important;
  color: ${({ theme, $showActive }) => ($showActive ? theme.token.colorPrimary : theme.palette.gray[6])} !important;
  box-shadow: ${({ theme, $showActive }) =>
    $showActive ? `0 0 0 2px ${theme.token.colorPrimary}33` : "none"} !important;

  &:not(:disabled):hover {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  &:active {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.token.colorPrimary}33 !important;
  }

  &:focus-visible {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.token.colorPrimary}33 !important;
  }
`;

const PathBarSearchInput = styled(Input.Search)<{ $compact?: boolean; $refreshPadding: number }>`
  .ant-input-search-button:not(:disabled):hover,
  .ant-input-search-button:not(:disabled):active {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  ${({ $compact }) =>
    $compact
      ? `
    .ant-input-wrapper {
      height: ${COMPACT_BAR_HEIGHT}px;
    }
    .ant-input-affix-wrapper {
      height: ${COMPACT_BAR_HEIGHT}px;
      padding-top: 0;
      padding-bottom: 0;
    }
    input.ant-input {
      height: 100%;
    }
    .ant-input-group-addon .ant-btn {
      height: ${COMPACT_BAR_HEIGHT}px !important;
      width: auto !important;
      padding-left: ${({ $refreshPadding }) => $refreshPadding}px !important;
      padding-right: ${({ $refreshPadding }) => $refreshPadding}px !important;
      border-radius: 0 4px 4px 0 !important;
    }
  `
      : ""}
`;

export const PathBar: React.FC<Props> = ({
  path,
  loading,
  onPathChange,
  breadcrumbItemRender,
  prefix,
  compact,
  refreshPadding = 18,
}) => {
  const [state, setState] = useState<"bar" | "input">("bar");
  const [input, setInput] = useState(path);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  useEffect(() => {
    setInput(path);
  }, [path]);

  // loading 结束时重置
  useEffect(() => {
    if (!loading) {
      setIsManualRefresh(false);
    }
  }, [loading]);

  const pathSegments = path === "/" ? [""] : path.split("/");
  // 是否是刷新动作（路径没变）
  const isRefresh = path === input;
  const icon = isRefresh ? <FreshIcon /> : <RightOutlined />;

  // 主动刷新 + loading 中 → 显示主题色
  const showActive = isManualRefresh && loading;

  return (
    <Bar
      onBlur={() => {
        setInput(path);
        setState("bar");
      }}
    >
      {state === "input" ? (
        <PathBarSearchInput
          $compact={compact}
          $refreshPadding={refreshPadding}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onSearch={(value) => {
            const trimmed = value.trim();
            setInput(trimmed);
            onPathChange(trimmed);
          }}
          enterButton={icon}
          autoFocus
          prefix={prefix}
        />
      ) : (
        <>
          <BarStateBar $compact={compact} onClick={() => setState("input")}>
            <Breadcrumb
              style={{ alignSelf: "center" }}
              items={pathSegments.map((segment, index) => ({
                key: index,
                title: breadcrumbItemRender(segment, index, pathSegments.slice(1, index + 1).join("/")),
              }))}
            />
          </BarStateBar>
          {compact ? (
            <CompactRefreshButton
              $refreshPadding={refreshPadding}
              $showActive={showActive}
              onClick={(e) => {
                e.stopPropagation();
                if (isRefresh) setIsManualRefresh(true); // 标记主动刷新
                onPathChange(input);
              }}
              icon={icon}
            />
          ) : (
            <RefreshButton
              $refreshPadding={refreshPadding}
              $showActive={showActive}
              onClick={(e) => {
                e.stopPropagation();
                if (isRefresh) setIsManualRefresh(true);
                onPathChange(input);
              }}
              icon={icon}
            />
          )}
        </>
      )}
    </Bar>
  );
};
