import { FormInstance } from "antd";
import dayjs from "dayjs";
import React, { useCallback, useMemo } from "react";
import type { Cluster } from "src/utils/cluster";

// 和AdminJobTable.tsx中的FilterForm保持一致
export interface FilterForm {
  jobEndTime: [dayjs.Dayjs, dayjs.Dayjs];
  jobIds?: string;
  accountName: string;
  userId: string;
  clusters: Cluster[];
}

/**
 * 解析作业ID字符串，返回去重后的数字数组
 * @param jobIds - 输入的作业ID字符串，可以用中英文逗号分隔
 * @returns 去重后的纯数字数组
 */
export const parseJobIds = (jobIds: string | undefined): number[] => {
  if (!jobIds || jobIds.trim().length === 0) {
    return [];
  }

  const uniqueValidIds = new Set<number>();

  // 2. 统一分隔符（英文逗号 `,` 或中文逗号 `，`）并分割
  const rawIds = jobIds.split(/[,，]+/); // 使用 + 处理连续多个逗号的情况

  for (const item of rawIds) {
    const trimmedItem = item.trim();

    if (trimmedItem && /^\d+$/.test(trimmedItem)) {
      const numId = parseInt(trimmedItem, 10);
      // 6. 检查是否在安全整数范围内
      if (Number.isSafeInteger(numId)) {
        uniqueValidIds.add(numId);
      }
    }
  }

  return Array.from(uniqueValidIds);
};

// 过滤非法字符
const filterIllegalChars = (value: string): string => {
  return value.replace(/[^\d,，]/g, "");
};

// 验证作业ID
export const validateJobIds = (value: string | undefined): Promise<void> => {
  if (!value) return Promise.resolve();

  if (/[^\d,，]/.test(value)) {
    return Promise.reject(new Error("onlyNumbersAndCommas"));
  }
  return Promise.resolve();
};

// 防抖工具函数
const createDebounce = (delay: number) => {
  let timerId: NodeJS.Timeout | null = null;

  return (callback: () => void) => {
    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      callback();
      timerId = null;
    }, delay);
  };
};

// 自定义Hook, 用于处理作业ID输入框的事件
export const useJobIdsInput = (
  form: FormInstance<FilterForm>,
  errorMessage: string,
) => {
  const debounce = useMemo(() => createDebounce(300), []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      const filtered = filterIllegalChars(value);

      if (filtered !== value) {
        form.setFieldValue("jobIds", filtered);
        // 清除错误信息
        form.setFields([{
          name: "jobIds",
          errors: [],
        }]);
      }
    },
    [form],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const hasIllegalChars = /[^\d,，]/.test(value);
      const filtered = filterIllegalChars(value);

      // 立即过滤并更新值
      if (filtered !== value) {
        form.setFieldValue("jobIds", filtered);
      }

      // 防抖处理错误提示
      debounce(() => {
        if (hasIllegalChars && value !== "") {
          form.setFields([{
            name: "jobIds",
            errors: [errorMessage],
          }]);
        } else {
          form.setFields([{
            name: "jobIds",
            errors: [],
          }]);
        }
      });
    },
    [form, errorMessage, debounce],
  );

  const handleBlur = useCallback(
    async (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      try {
        await validateJobIds(value);
        form.setFields([{
          name: "jobIds",
          errors: [],
        }]);
      } catch {
        form.setFields([{
          name: "jobIds",
          errors: [errorMessage],
        }]);
      }
    },
    [form, errorMessage],
  );

  return {
    handleCompositionEnd,
    handleChange,
    handleBlur,
  };
};
