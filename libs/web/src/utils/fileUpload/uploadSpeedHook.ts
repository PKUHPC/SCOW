import { useCallback, useEffect, useRef, useState } from "react";

import { formatSpeed } from "./uploadUtils";

export interface SpeedSample {
  bytes: number;
  time: number;
}

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

  // 启动定时器
  const startTimer = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setSpeedInfoMap((prevMap) => {
        if (prevMap.size === 0) return prevMap;

        const newMap = new Map(prevMap);
        const now = Date.now();

        // 更新每个文件的速度信息
        newMap.forEach((info, fileUid) => {
          const samples = info.samples;

          if (samples.length >= 2) {
            // 保留最近10秒的采样点
            const tenSecondsAgo = now - 10000;
            const recentSamples = samples.filter((sample) => sample.time >= tenSecondsAgo);

            if (recentSamples.length >= 2) {
              const firstSample = recentSamples[0];
              const lastSample = recentSamples[recentSamples.length - 1];

              const bytesDiff = lastSample.bytes - firstSample.bytes;
              const timeDiff = (lastSample.time - firstSample.time) / 1000;

              const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

              newMap.set(fileUid, {
                ...info,
                samples: recentSamples,
                speedText: formatSpeed(speed),
                bytesPerSecond: speed,
              });
            }
          }
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
    const now = Date.now();

    setSpeedInfoMap((prev) => {
      const info = prev.get(fileUid);
      if (!info) return prev;

      const newSamples = [...info.samples, { bytes: uploadedBytes, time: now }];

      const newMap = new Map(prev);
      newMap.set(fileUid, {
        ...info,
        samples: newSamples,
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
