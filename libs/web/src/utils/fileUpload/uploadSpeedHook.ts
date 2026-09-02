import { useCallback, useEffect, useRef, useState } from "react";

import type { UploadSpeedSample } from "./uploadCalculation";

import { calculateUploadSpeed } from "./uploadCalculation";
import { formatSpeed } from "./uploadUtils";

export type SpeedSample = UploadSpeedSample;

export interface FileSpeedInfo {
  speedText: string;
  bytesPerSecond: number;
  samples: SpeedSample[];
  sessionStartBytes: number;
  sessionStartTime: number;
}

export interface UseUploadSpeedTrackerResponse {
  // 初始化文件速度追踪
  initFileSpeed: (fileUid: string, initialBytes?: number) => void;
  // 更新文件的已上传字节数
  updateFileBytes: (fileUid: string, uploadedBytes: number) => void;
  // 获取文件速度信息
  getFileSpeed: (fileUid: string) => FileSpeedInfo | undefined;
  // 清理单个文件的速度信息
  cleanupFile: (fileUid: string) => void;
  // 清理所有文件的速度信息
  cleanupAll: () => void;
}

export const useUploadSpeedTracker = (
  // 更新间隔，默认1秒
  updateInterval = 1000,
): UseUploadSpeedTrackerResponse => {
  const [speedInfoMap, setSpeedInfoMap] = useState<Map<string, FileSpeedInfo>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestProgressRef = useRef(new Map<string, { bytes: number; time: number }>());

  // 启动定时器
  const startTimer = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setSpeedInfoMap((prevMap) => {
        if (prevMap.size === 0) return prevMap;

        const newMap = new Map(prevMap);
        const now = Date.now();

        newMap.forEach((info, fileUid) => {
          const latestProgress = latestProgressRef.current.get(fileUid) ?? {
            bytes: info.sessionStartBytes,
            time: info.sessionStartTime,
          };
          const { bytesPerSecond, samples } = calculateUploadSpeed(
            info.samples,
            latestProgress.bytes,
            now,
            latestProgress.time,
          );

          newMap.set(fileUid, {
            ...info,
            samples,
            speedText: formatSpeed(bytesPerSecond),
            bytesPerSecond,
          });
        });

        return newMap;
      });
    }, updateInterval);
  }, [updateInterval]);

  // 停止定时器
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 初始化文件速度追踪
  const initFileSpeed = useCallback(
    (fileUid: string, initialBytes = 0) => {
      const now = Date.now();
      latestProgressRef.current.set(fileUid, { bytes: initialBytes, time: now });

      setSpeedInfoMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileUid, {
          speedText: "0 B/s",
          bytesPerSecond: 0,
          samples: [{ bytes: initialBytes, time: now }],
          sessionStartBytes: initialBytes,
          sessionStartTime: now,
        });
        return newMap;
      });

      // 启动定时器
      startTimer();
    },
    [startTimer],
  );

  // 更新文件的已上传字节数
  const updateFileBytes = useCallback((fileUid: string, uploadedBytes: number) => {
    const latestProgress = latestProgressRef.current.get(fileUid);
    if (!latestProgress) return;

    const now = Date.now();
    const nextBytes = Math.max(latestProgress.bytes, uploadedBytes);
    const lastProgressTime = nextBytes > latestProgress.bytes ? now : latestProgress.time;
    latestProgressRef.current.set(fileUid, { bytes: nextBytes, time: lastProgressTime });

    setSpeedInfoMap((prev) => {
      const info = prev.get(fileUid);
      if (!info) return prev;

      const newMap = new Map(prev);
      newMap.set(fileUid, {
        ...info,
        samples: [...info.samples, { bytes: nextBytes, time: now }],
      });
      return newMap;
    });
  }, []);

  // 获取文件速度信息
  const getFileSpeed = useCallback(
    (fileUid: string) => {
      return speedInfoMap.get(fileUid);
    },
    [speedInfoMap],
  );

  // 清理单个文件
  const cleanupFile = useCallback(
    (fileUid: string) => {
      latestProgressRef.current.delete(fileUid);
      setSpeedInfoMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileUid);

        // 如果没有文件在追踪了，停止定时器
        if (newMap.size === 0) {
          stopTimer();
        }

        return newMap;
      });
    },
    [stopTimer],
  );

  // 清理所有文件
  const cleanupAll = useCallback(() => {
    latestProgressRef.current.clear();
    setSpeedInfoMap(new Map());
    stopTimer();
  }, [stopTimer]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // 当没有文件追踪时自动停止定时器
  useEffect(() => {
    if (speedInfoMap.size === 0) {
      stopTimer();
    }
  }, [speedInfoMap.size, stopTimer]);

  return {
    initFileSpeed,
    updateFileBytes,
    getFileSpeed,
    cleanupFile,
    cleanupAll,
  };
};
