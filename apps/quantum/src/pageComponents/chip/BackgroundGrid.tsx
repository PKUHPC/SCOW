import { range } from "d3-array";
import React from "react";

const GRID_COLOR = "#E5E7EB"; // 背景网格线

interface Props {
  width: number;
  height: number;
  step: number;
}

// 背景网格
export const BackgroundGrid: React.FC<Props> = ({ width, height, step }) => {
  const verticalLines = range(0, width + 1, step);
  const horizontalLines = range(0, height + 1, step);

  return (
    <g>
      {verticalLines.map((x) => (
        <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={height} stroke={GRID_COLOR} strokeWidth={1} />
      ))}
      {horizontalLines.map((y) => (
        <line key={`h-${y}`} x1={0} y1={y} x2={width} y2={y} stroke={GRID_COLOR} strokeWidth={1} />
      ))}
    </g>
  );
};
