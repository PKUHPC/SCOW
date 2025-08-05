/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Tooltip } from "antd";
import React from "react";

type Props = React.PropsWithChildren<{
  onClick?: () => void;
  disabled?: boolean;
  message?: React.ReactNode;
  abledMessage?: string;
}>;

export const DisabledA: React.FC<Props> = React.forwardRef(({
  onClick, disabled, message, children, abledMessage }, ref) => {

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
