import { Tooltip } from "antd";
import React from "react";

type Props = React.PropsWithChildren<{
  onClick?: () => void;
  disabled?: boolean;
  message?: React.ReactNode;
  abledMessage?: string;
}>;

export const DisabledA: React.FC<Props> = React.forwardRef(
  ({ onClick, disabled, message, children, abledMessage }, ref) => {
    if (!disabled) {
      return (
        <Tooltip title={abledMessage}>
          <a onClick={onClick}>{children}</a>
        </Tooltip>
      );
    }

    if (message) {
      return (
        <Tooltip ref={ref as any} overlay={message}>
          <span>{children}</span>
        </Tooltip>
      );
    } else {
      return <span ref={ref as any}>{children}</span>;
    }
  },
);
