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

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FC } from "react";

import { EntryCardItem, EntryCardItemProps } from "./CardItem";

export const SortableItem: FC<EntryCardItemProps> = (props) => {
  const {
    isDragging,
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id, disabled:!props.draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    boxShadow: "none",
    borderRadius:"8px",
  };

  return (
    <EntryCardItem
      ref={setNodeRef}
      style={style}
      transparent={isDragging}
      {...props}
      {...attributes}
      {...listeners}
    />
  );
};
