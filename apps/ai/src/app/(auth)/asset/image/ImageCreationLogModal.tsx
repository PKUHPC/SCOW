"use client";
import type { inferRouterOutputs } from "@trpc/server";

import { App, Modal, Spin } from "antd";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Status } from "src/models/Image";
import { AppRouter } from "src/server/trpc/router";
import { CreationOperation } from "src/server/utils/imageCreationManager";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

const ContentContainer = styled.div`
  /* Layout */
  width: 100%;
  height: 400px;
  border-radius: 8px;
  border-width: 1px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const LogContainer = styled.div`
  /* Layout */
  padding: 24px 0;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  width: 100%; /* 确保宽度100% */

  /* Typography */
  font-weight: 330;
  font-size: 14px;
  line-height: 22px;

  /* 垂直滚动条样式 */
  &::-webkit-scrollbar:vertical {
    width: 6px;
  }

  /* 水平滚动条样式 */
  &::-webkit-scrollbar:horizontal {
    height: 6px;
  }

  /* 通用滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
`;

const LogText = styled.pre`
  color: #888fa3;
  white-space: pre;
  word-break: keep-all;
  overflow-wrap: normal;
  font-weight: 330;
  font-size: 14px;
  line-height: 22px;
  margin: 0;
  padding: 0;
  min-width: 100%;
  width: max-content;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888fa3;
  font-weight: 300;
  font-size: 12px;
  line-height: 22px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Cursor = styled.span`
  animation: blink 1s infinite;
  color: #888fa3;

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }
`;

const StyledModal = styled(Modal)`
  .ant-modal-header {
    height: 62px;
    display: flex;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid #f0f0f0 !important;
  }

  .ant-modal-title {
    font-size: 16px;
    font-weight: 500;
    line-height: 62px;
  }

  && .ant-modal-close {
    top: 36px !important;
    right: 24px;
  }
`;

interface Props {
  imageId: number;
  status: Status;
  failedReason?: string;
  open: boolean;
  onClose: () => void;
}

interface QueryState {
  skip: number;
  lastQueriedOperation?: CreationOperation;
  lastQueriedCompleted: boolean;
}

type ImageCreationLogData = inferRouterOutputs<AppRouter>["image"]["getImageCreationLog"];

// 最大保留 2 万个字符，防止内存溢出，防止渲染卡顿
const MAX_LOG_LENGTH = 20000;

export const ImageCreationLogModal: React.FC<Props> = ({ imageId, status, failedReason, open, onClose }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.imageLogModal.");
  const { message } = App.useApp();
  // 指向包裹日志的 <div> 容器。用于控制计算滚动条
  const logContainerRef = useRef<HTMLDivElement>(null);
  // 指向存放文字的 span，直接操作ref追加文字
  const logTextRef = useRef<HTMLSpanElement>(null);
  // 在内存中保存当前操作的完整日志
  const fullLogRef = useRef<string>("");
  // 打字机缓冲日志区
  const pendingLogRef = useRef("");
  // 是否为第一次加载
  const isFirstLoadRef = useRef<boolean>(true);

  // 模态框标题
  const [modalTitle, setModalTitle] = useState<string>(t(p("creating")));
  // 当前进行的步骤
  const [currentOperation, setCurrentOperation] = useState<CreationOperation>(CreationOperation.UNKNOWN);
  // 任务是否结束，结束停止轮询
  const [isFinished, setIsFinished] = useState(false);
  // 页面上的日志显示切换开关
  const [showLog, setShowLog] = useState(false);

  // 轮询查询状态
  const [queryState, setQueryState] = useState<QueryState>({
    skip: 0,
    lastQueriedOperation: undefined,
    lastQueriedCompleted: false,
  });

  // ============ 打字机配置 ============
  // 使用 Ref 实时记录打字机是否在运行，解决闭包卡死问题
  const isTypingRef = useRef(false);
  // 用于组件销毁或重置时清除定时器
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  // 打字机光标显示开关
  const [isTyping, setIsTyping] = useState(false);

  // 每次显示的字符数
  const TYPING_SPEED = 500;
  // 打字间隔（毫秒）
  const TYPING_INTERVAL = 0;
  const getTypingSpeed = (length: number) => {
    // 积压严重，极速追赶
    if (length > 10000) return 5000;
    // 积压较多，加速
    if (length > 2000) return 1000;
    // 正常速度
    return TYPING_SPEED;
  };

  const { data, error, isFetching } = trpc.image.getImageCreationLog.useQuery(
    {
      id: imageId,
      skip: queryState.skip,
      lastQueriedOperation: queryState.lastQueriedOperation,
    },
    {
      enabled: open && status === Status.CREATING && !isFinished,
      refetchInterval: isFinished ? false : 1000,
      refetchIntervalInBackground: false, // 防止后台重复请求
      refetchOnWindowFocus: false, // 防止窗口聚焦时重复请求
    },
  );
  useEffect(() => {
    if (error) {
      message.error(t(p("logFoundError")));
    }
  }, [error, t, p]);

  // 直接将文本注入 DOM 并滚动
  // 直接修改网页模态框内日志显示
  const appendTextToDOM = useCallback((text: string, isReset: boolean = false) => {
    if (!logTextRef.current) return;
    let newContent = "";

    if (isReset) {
      newContent = text;
    } else {
      const currentContent = logTextRef.current.textContent || "";
      newContent = currentContent + text;
    }

    // 如果内容过长，只保留末尾
    if (newContent.length > MAX_LOG_LENGTH) {
      newContent = newContent.slice(-MAX_LOG_LENGTH);
    }

    logTextRef.current.textContent = newContent;
    // 滚动到底部
    if (logContainerRef.current) {
      const container = logContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // 打字机实现
  const performTyping = useCallback(() => {
    const pending = pendingLogRef.current;

    // 缓冲区没字，停止打字
    if (!pending) {
      isTypingRef.current = false;
      setIsTyping(false);
      return;
    }

    isTypingRef.current = true;
    setIsTyping(true);

    const speed = getTypingSpeed(pending.length);
    const chunkSize = Math.min(speed, pending.length);
    const chunk = pending.slice(0, chunkSize);
    pendingLogRef.current = pending.slice(chunkSize);

    appendTextToDOM(chunk);

    // 继续打字
    if (pendingLogRef.current.length > 0) {
      typingTimeoutRef.current = setTimeout(performTyping, TYPING_INTERVAL);
    } else {
      isTypingRef.current = false;
      setIsTyping(false);
    }
  }, [appendTextToDOM]);

  // 数据处理
  const handleLogDataSuccess = useCallback(
    (data: ImageCreationLogData) => {
      if (!data) {
        return;
      }

      // 1. 更新标题和操作状态
      updateModalTitle(data.currentOperation);

      // 2. 检查是否完成
      if (data.isPushedCompleted) {
        setIsFinished(true);
      }

      const operationChanged =
        currentOperation !== CreationOperation.UNKNOWN && currentOperation !== data.currentOperation;

      // 3. 操作切换时 清空相关Ref，重置DOM，重置Query
      if (operationChanged) {
        // 操作切换时，清空显示并重新开始
        fullLogRef.current = "";
        pendingLogRef.current = "";
        isFirstLoadRef.current = true;
        setShowLog(false);
        if (logTextRef.current) logTextRef.current.textContent = "";

        // 更新查询状态
        setQueryState({
          skip: 0,
          lastQueriedOperation: currentOperation,
          lastQueriedCompleted: true,
        });
      }

      // 4.收到日志数据时，大快数据不走打字机，实时增量打字输出
      if (data.logChunk) {
        const chunk = data.logChunk;
        // 始终维护一份内存中的完整日志，用于重新打开模态框时恢复
        fullLogRef.current += chunk;

        // 内存截断：防止极端情况下内存溢出，超过1.5倍阈值时切换
        if (fullLogRef.current.length > MAX_LOG_LENGTH * 1.5) {
          fullLogRef.current = fullLogRef.current.slice(-MAX_LOG_LENGTH * 1.5);
        }

        setShowLog(true);

        // 使用 setTimeout(..., 0) 确保 React 完成了对 <span /> 的渲染
        setTimeout(() => {
          const isBulkData = chunk.length > 2000;
          if (isFirstLoadRef.current || isBulkData) {
            // 如果是大量数据，直接显示内存中的最新完整快照
            const textToShow = isBulkData ? fullLogRef.current.slice(-MAX_LOG_LENGTH) : chunk;

            appendTextToDOM(textToShow, true);

            isFirstLoadRef.current = false;
            // 清空可能存在的积压
            pendingLogRef.current = "";

            if (isBulkData) {
              isTypingRef.current = false;
              setIsTyping(false);
            } else {
              performTyping();
            }
            // 后续增量进入队列
          } else {
            pendingLogRef.current += chunk;
            if (!isTypingRef.current) {
              performTyping();
            }
          }
        }, 0);
      }
      // 同一操作内的数据更新
      setQueryState((prev) => ({
        ...prev,
        lastQueriedOperation: data.currentOperation,
        lastQueriedCompleted: data.isCompleted || false,
        skip: data.totalResChunkSizeForCurrentOperation || 0,
      }));

      // 5. 更新当前操作
      setCurrentOperation(data.currentOperation);
    },
    [currentOperation, queryState.lastQueriedOperation],
  );

  useEffect(() => {
    if (data) {
      handleLogDataSuccess(data);
    }
  }, [data]);

  const updateModalTitle = useCallback(
    (operation: CreationOperation) => {
      switch (operation) {
        case CreationOperation.LOAD_IMAGE:
          setModalTitle(t(p("loadTitle")));
          break;
        case CreationOperation.COMMIT_IMAGE:
          setModalTitle(t(p("commitTitle")));
          break;
        case CreationOperation.PULL_IMAGE:
          setModalTitle(t(p("pullTitle")));
          break;
        case CreationOperation.PUSH_IMAGE:
          setModalTitle(t(p("pushTitle")));
          break;
        default:
          setModalTitle(t(p("creating")));
          break;
      }
    },
    [setModalTitle, t, p],
  );

  // 使用 useLayoutEffect 在模态框再开时瞬间恢复已有的日志
  React.useLayoutEffect(() => {
    if (open && fullLogRef.current) {
      setShowLog(true);

      // 1. 停止当前可能正在进行的打字机
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      isTypingRef.current = false;
      setIsTyping(false);
      pendingLogRef.current = ""; // 清空待打字队列

      // 2.瞬间恢复文本
      if (logTextRef.current) {
        logTextRef.current.textContent = fullLogRef.current.slice(-MAX_LOG_LENGTH);
      }

      // 3.瞬间同步滚动
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }

      // 双重保险：防止 Modal 的 CSS 动画导致初次计算高度不准
      // requestAnimationFrame 会在下一帧渲染前执行，通常人眼无法察觉
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      });
    }
  }, [open]);

  // 重置状态
  const resetState = useCallback(() => {
    setCurrentOperation(CreationOperation.UNKNOWN);
    setIsFinished(false);
    setShowLog(false);
    setQueryState({
      skip: 0,
      lastQueriedOperation: undefined,
      lastQueriedCompleted: false,
    });

    isFirstLoadRef.current = true;
    pendingLogRef.current = "";
    fullLogRef.current = "";
    isTypingRef.current = false;
    setIsTyping(false);

    // 直接清空 DOM
    if (logTextRef.current) {
      logTextRef.current.textContent = "";
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    updateModalTitle(CreationOperation.UNKNOWN);
  }, []);

  useEffect(() => {
    // 只有当 imageId 变了，才彻底清空
    resetState();
  }, [imageId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const renderContent = () => {
    if (status === Status.FAILURE) {
      return (
        <LogContainer>
          <LogText>{failedReason ? failedReason : t(p("unknownFailure"))}</LogText>
        </LogContainer>
      );
    }

    return (
      <LogContainer ref={logContainerRef}>
        {/* 日志组件始终存在于 DOM 树，只是通过 display 控制隐藏 */}
        <div style={{ display: showLog ? "block" : "none" }}>
          <LogDisplay ref={logTextRef} showCursor={isTyping} />
        </div>
        {!showLog && (
          <EmptyState>
            {isFetching ? (
              <LoadingContainer>
                <Spin />
                <span>{t(p("fetchingLog"))}</span>
              </LoadingContainer>
            ) : (
              t(p("noLog"))
            )}
          </EmptyState>
        )}
      </LogContainer>
    );
  };

  return (
    <StyledModal
      title={status === Status.FAILURE ? t(p("failedTitle")) : modalTitle}
      open={open}
      onCancel={onClose}
      width={1050}
      centered
      destroyOnClose={false}
      footer={null}
    >
      <ContentContainer>{renderContent()}</ContentContainer>
    </StyledModal>
  );
};

// 使用 React.memo防止内容被React重置，避免高频无效渲染
const LogDisplay = React.memo(
  React.forwardRef<HTMLSpanElement, { showCursor: boolean }>((props, ref) => {
    return (
      <LogText>
        <span ref={ref} />
        {props.showCursor && <Cursor>|</Cursor>}
      </LogText>
    );
  }),
);
