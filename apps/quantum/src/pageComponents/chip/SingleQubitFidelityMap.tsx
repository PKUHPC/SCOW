import { Typography } from "antd";
import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { QubitData } from "src/models/device";
import { BackgroundGrid } from "src/pageComponents/chip/BackgroundGrid";
import { ColorLegend } from "src/pageComponents/chip/ColorLegend";
import { HorizontalColorLegend } from "src/pageComponents/chip/HorizontalColorLegend";
import type { getLayoutMap } from "src/utils/chip";

interface Props {
  qubits: QubitData[];
  coords: ReturnType<typeof getLayoutMap>;
  maxX: number;
  maxY: number;
  isFullWidth?: boolean;
  nodeSize: number;
  fontSize: number;
  legendBelowChart: boolean;
}

// 单比特方块间距
const SQ_NODE_GAP = 0;

export const SingleQubitFidelityMap: React.FC<Props> =
({ qubits, coords, maxX, maxY, isFullWidth, nodeSize, fontSize, legendBelowChart }) => {
  if (Object.keys(coords).length === 0) {
    return null;
  }

  // 构建一个 qubits 数据的 Map 以便快速查找
  const qubitsMap = new Map(qubits.map((q) => [q.Q, q]));
  const fids = qubits.map((q) => 1 - q.Err.SQ);
  const originalMinF = min(fids) ?? 0.9980;
  const originalMaxF = max(fids) ?? 1;
  const minF = Math.floor(originalMinF * 1000) / 1000;
  const maxF = Math.ceil(originalMaxF * 1000) / 1000;

  const color = scaleLinear<string, string>()
    .domain([minF, maxF])
    .range(["#f5d270", "#0a1162"]);

  const SQ_NODE_SIZE = isFullWidth ? nodeSize * 1.2 : nodeSize;
  const SQ_FONT_SIZE = isFullWidth ? fontSize * 1.1 : fontSize;

  const width = (maxX + 1) * (SQ_NODE_SIZE + SQ_NODE_GAP);
  const height = (maxY + 1) * (SQ_NODE_SIZE + SQ_NODE_GAP);

  // 根据 legendBelowChart 调整 SVG 尺寸
  const legendWidth = 110;
  // 当图例换行时，主SVG不再需要为图例预留空间
  const svgW = legendBelowChart ? width : width + legendWidth;
  const svgH = legendBelowChart ? height : height + 20;

  const { Text } = Typography;
  const t = useI18nTranslateToString();
  const p = prefix("page.chip.");

  const topTextY = -(SQ_FONT_SIZE * 0.5);
  const bottomTextY = (SQ_FONT_SIZE * 1.2);

  return (
    <div style={{
      background: "#fff",
      width: isFullWidth && legendBelowChart ? "90%" : "100%",
      margin: isFullWidth ? "0 auto" : "0",
    }}
    >
      <div style={{ marginBottom: "12px" }}>
        <Text>{t(p("SQFidelity"))}</Text>
      </div>

      <div style={{ overflowX: legendBelowChart ? "auto" : "visible",
        ...(legendBelowChart ? {} : {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }),
      }}
      >
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <BackgroundGrid width={width} height={height} step={SQ_NODE_SIZE + SQ_NODE_GAP} />
          <g transform={`translate(${SQ_NODE_SIZE / 2},${SQ_NODE_SIZE / 2})`}>
            {Object.entries(coords).map(([qId, p]) => {
              const q = qubitsMap.get(Number(qId));
              const x = p.x * (SQ_NODE_SIZE + SQ_NODE_GAP);
              const y = p.y * (SQ_NODE_SIZE + SQ_NODE_GAP);
              if (q) {
                const fid = 1 - q.Err.SQ;
                const fill = color(fid);
                return (
                  <g key={qId} transform={`translate(${x},${y})`}>
                    <rect
                      x={-SQ_NODE_SIZE / 2}
                      y={-SQ_NODE_SIZE / 2}
                      width={SQ_NODE_SIZE}
                      height={SQ_NODE_SIZE}
                      fill={fill}
                    />
                    <text
                      y={topTextY}
                      textAnchor="middle"
                      fontSize={SQ_FONT_SIZE}
                      fill="#fff"
                    >
                      {(fid * 100).toFixed(2)}%
                    </text>
                    <text
                      y={bottomTextY}
                      textAnchor="middle"
                      fontSize={SQ_FONT_SIZE * 0.8}
                      fill="#ff0"
                      style={{ fontStyle: "italic", opacity: 0.6 }}
                    >
                      {q.Q}
                    </text>
                  </g>
                );
              }
              return (
                <g key={qId} transform={`translate(${x},${y})`}>
                  <rect
                    x={-SQ_NODE_SIZE / 2}
                    y={-SQ_NODE_SIZE / 2}
                    width={SQ_NODE_SIZE}
                    height={SQ_NODE_SIZE}
                    fill="#ccc"
                  />
                  <text
                    textAnchor="middle"
                    fontSize={SQ_FONT_SIZE * 0.8}
                    fill="#b58383"
                    dominantBaseline="middle"
                    style={{ fontStyle: "italic", opacity: 0.8 }}
                  >
                    {qId}
                  </text>
                </g>
              );
            })}
          </g>
          {!legendBelowChart && (
            <g transform={`translate(${width + 28},0)`}>
              <ColorLegend
                id="sqLegend"
                height={svgH - 50}
                color={color}
                domain={[minF, maxF]}
                format={(n) => (n * 100).toFixed(2)}
              />
            </g>
          )}
        </svg>

      </div>
      {legendBelowChart && (
        <div style={{ marginTop: "16px",
          width: "100%",
          textAlign: "center",
        }}
        >
          <svg width={window.innerWidth * 0.6 + 40} height={40}>
            <HorizontalColorLegend
              id="sqLegend"
              color={color}
              domain={[minF, maxF]}
              format={(n) => (n * 100).toFixed(2)}
            />
          </svg>
        </div>
      )}
    </div>
  );
};
