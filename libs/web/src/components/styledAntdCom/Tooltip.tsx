import type { FC } from "react";

import { Tooltip as AntdTooltip, type TooltipProps } from "antd";
import { useTheme } from "styled-components";

export const Tooltip: FC<TooltipProps> = ({ color, ...props }) => {
  const theme = useTheme();
  const defaultColor = theme.palette.gray[7] ?? "#595959";

  return <AntdTooltip color={color ?? defaultColor} {...props} />;
};
