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
      $transparent={isDragging}
      {...props}
      {...attributes}
      {...listeners}
    />
  );
};
