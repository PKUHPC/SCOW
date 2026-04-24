"use client";

import { type MouseEvent } from "react";
import { CollapseTableRowIcon, ExpandTableRowIcon } from "src/icons/operationIcon";
import { styled } from "styled-components";

const ExpandIconTrigger = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 0;
  cursor: pointer;
`;

interface TableExpandIconProps<T> {
  expanded: boolean;
  onExpand: (record: T, event: MouseEvent<HTMLElement>) => void;
  record: T;
}

export function TableExpandIcon<T>({ expanded, onExpand, record }: TableExpandIconProps<T>) {
  return (
    <ExpandIconTrigger onClick={(event) => onExpand(record, event)}>
      {expanded ? <CollapseTableRowIcon /> : <ExpandTableRowIcon />}
    </ExpandIconTrigger>
  );
}
