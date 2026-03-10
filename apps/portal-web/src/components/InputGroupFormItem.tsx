import { Input, Space } from "antd";
import { useCallback } from "react";

type Props = React.PropsWithChildren<{
  value?: string;
  onChange?: (value: string) => void;
  deltaWidth: string;
}>;

export const InputGroupFormItem: React.FC<Props> = ({ children, deltaWidth, value, onChange }) => {
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const trimmed = e.target.value.trim();
      if (trimmed !== e.target.value) {
        onChange?.(trimmed);
      }
    },
    [onChange],
  );

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ width: `calc(100% - ${deltaWidth})` }}
        onBlur={handleBlur}
      />
      {children}
    </Space.Compact>
  );
};
