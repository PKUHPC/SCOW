import type { getLayoutMap } from "src/utils/chip";

import React, { CSSProperties } from "react";

interface Props {
  linksData: number[][];
  coords: ReturnType<typeof getLayoutMap>;
  maxX: number;
  maxY: number;
  nodeSize: number;
  fontSize: number;
  isFullWidth: boolean;
}

// 定义常量，采用与参考图（深蓝和灰色）搭配的专业配色
const COLORS = {
  LINE_COLOR: "#DBDBDB", // 连接线颜色：沉稳的深蓝色，与参考图的主色调一致
  NODE_FILL: "#4B7D48", // 节点填充色：中性蓝灰色，与参考图中的节点和灰色块接近
  NODE_STROKE: "#f8f8fa", // 节点描边色：略浅的蓝灰色，增加一点层次感
  TEXT_COLOR: "#FFFFFF", // 节点数字颜色：白色，确保在深色节点上清晰可读
};

export const LayoutVis: React.FC<Props> = ({ linksData, coords, maxX, maxY, nodeSize, fontSize, isFullWidth }) => {
  if (Object.keys(coords).length === 0) {
    return null;
  }

  const SZ_NODE_SIZE = nodeSize;
  const SZ_FONT_SIZE = fontSize;

  // 间距和节点大小
  const CZ_SCALE = SZ_NODE_SIZE * 1;
  const CZ_NODE_R = SZ_NODE_SIZE * 0.22;
  // 定义线条的粗细，保持适中
  const LINE_STROKE_WIDTH = 3;
  const NODE_STROKE_WIDTH = 1.5;

  const svgW = (maxX + 1) * CZ_SCALE;
  const svgH = (maxY + 1) * CZ_SCALE;

  const containerStyle: CSSProperties = {
    width: isFullWidth ? "95%" : "100%",
    margin: "0 auto",
    padding: 0,
  };

  // SVG容器的条件样式逻辑
  const svgContainerConditionalStyle: CSSProperties = isFullWidth
    ? { overflowX: "auto" }
    : {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      };

  return (
    <div style={containerStyle}>
      <div style={svgContainerConditionalStyle}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: "transparent" }}>
          <g transform={`translate(${CZ_SCALE / 2},${CZ_SCALE / 2})`}>
            {/* 渲染连接线 */}
            {linksData.map((g) => {
              const [qa, qb] = g;
              const a = coords?.[qa];
              const b = coords?.[qb];
              if (!a || !b) return null;

              const x1 = a.x * CZ_SCALE;
              const y1 = a.y * CZ_SCALE;
              const x2 = b.x * CZ_SCALE;
              const y2 = b.y * CZ_SCALE;

              return (
                <g key={`link-${qa}-${qb}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={COLORS.LINE_COLOR}
                    strokeWidth={LINE_STROKE_WIDTH}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* 渲染节点和文本 */}
            {Object.entries(coords).map(([qs, p]) => {
              const q = Number(qs);
              const cx = p.x * CZ_SCALE;
              const cy = p.y * CZ_SCALE;
              return (
                <g key={`node-${q}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={CZ_NODE_R}
                    fill={COLORS.NODE_FILL}
                    stroke={COLORS.NODE_STROKE}
                    strokeWidth={NODE_STROKE_WIDTH}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={SZ_FONT_SIZE}
                    fill={COLORS.TEXT_COLOR}
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {q}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
