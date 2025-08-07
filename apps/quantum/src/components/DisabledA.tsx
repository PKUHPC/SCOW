import { Tooltip } from "antd";
import React, { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  onClick?: () => void;
  disabled?: boolean;
  message?: React.ReactNode;
  abledMessage?: React.ReactNode;
}>;

export const DisabledA: React.FC<Props> = React.forwardRef(
  ({ onClick, disabled, message, children, abledMessage }, ref) => {

    if (!disabled) {
      return <Tooltip title={abledMessage}><a onClick={onClick}>{children}</a></Tooltip>;
    }

    if (message) {
      return (
        <Tooltip ref={ref as any} overlay={message}>
          <span>{children}</span>
        </Tooltip>
      );
    } else {
      return (
        <span ref={ref as any}>{children}</span>
      );
    }

  });
