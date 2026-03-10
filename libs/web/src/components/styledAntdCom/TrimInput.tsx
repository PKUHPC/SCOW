import { Input, InputProps, InputRef } from "antd";
import React, { useCallback } from "react";

// Input输入时，在失焦时自动去除前后空格
// 使用 forwardRef, 让 ref 可以穿透函数组件，传给内部真正的元素, 使对外表现得和 antd Input 完全一致
export const TrimInput = React.forwardRef<InputRef, InputProps>(
  ({ onBlur, onChange, value, ...rest }, ref) => {

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {

        const raw = e.target.value;
        const trimmed = raw.trim();

        // 有变化才触发（包含纯空格 → "" 的情况）
        if (trimmed !== raw && onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: trimmed },
            currentTarget: { ...e.currentTarget, value: trimmed },
          } as React.ChangeEvent<HTMLInputElement>;

          onChange(syntheticEvent);
        }

        onBlur?.(e);

      },
      [onChange, onBlur],
    );

    return (
      <Input
        ref={ref}
        {...rest}
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
      />
    );
  },
);

// forwardRef 组件在 DevTools 里显示为 "TrimInput", 便于调试
TrimInput.displayName = "TrimInput";
