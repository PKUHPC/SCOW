import type { getLayoutMap } from "src/utils/chip";

import { Typography } from "antd";
import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CZGateData } from "src/models/device";
import { BackgroundGrid } from "src/pageComponents/chip/BackgroundGrid";
import { ColorLegend } from "src/pageComponents/chip/ColorLegend";
import { HorizontalColorLegend } from "src/pageComponents/chip/HorizontalColorLegend";

interface Props {
  cz: CZGateData[];
  coords: ReturnType<typeof getLayoutMap>;
  maxX: number;
  maxY: number;
  isFullWidth?: boolean;
  nodeSize: number;
  fontSize: number;
  legendBelowChart: boolean;
  offsetDegree: number;
}

export const CZGateFidelityMap: React.FC<Props> = ({
  cz,
  coords,
  maxX,
  maxY,
  isFullWidth,
  nodeSize,
  fontSize,
  legendBelowChart,
  offsetDegree,
}) => {
  if (Object.keys(coords).length === 0) {
    return null;
  }

  const SZ_NODE_SIZE = isFullWidth ? nodeSize * 1.2 : nodeSize;
  const SZ_FONT_SIZE = isFullWidth ? fontSize * 1.1 : fontSize;

  const fids = cz.map((g) => g.Fidelity);
  const originalMinF = min(fids) ?? 0.965;
  const originalMaxF = max(fids) ?? 1.0;
  const minF = Math.floor(originalMinF * 1000) / 1000;
  const maxF = Math.ceil(originalMaxF * 1000) / 1000;

  const color = scaleLinear<string, string>().domain([minF, maxF]).range(["#8fc2de", "#06316d"]);

  // 检查是否为 45度的奇数倍，确定缩放因子
  const normalizedDegrees = offsetDegree % 360;
  const factor = normalizedDegrees / 45;
  const isOddMultipleOf45 = Math.round(factor) % 2 !== 0 && Math.round(factor) !== 0;

  // 使用与单比特图相同的间距和节点大小
  const CZ_SCALE = SZ_NODE_SIZE;
  const CZ_NODE_R = SZ_NODE_SIZE * 0.15;
  // 定义带有直角的六边形的尺寸
  const HEX_LENGTH = SZ_NODE_SIZE * (isOddMultipleOf45 ? 0.6 : 0.45);
  const HEX_WIDTH = SZ_NODE_SIZE * (isOddMultipleOf45 ? 0.35 : 0.3);
  const HEX_TIP_WIDTH = SZ_NODE_SIZE * (isOddMultipleOf45 ? 0.35 : 0.3);

  const width = (maxX + 1) * CZ_SCALE;
  const height = (maxY + 1) * CZ_SCALE;

  // 根据 legendBelowChart 调整 SVG 尺寸
  const legendWidth = 110;
  const svgW = legendBelowChart ? width : width + legendWidth;
  const svgH = legendBelowChart ? height : height + 20;

  const { Text } = Typography;
  const t = useI18nTranslateToString();
  const p = prefix("page.chip.");

  // 六边形路径
  function orientedRightAngleHexagonPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    length: number,
    width: number,
    tipWidth: number,
  ) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    const p1x = cx + length * Math.cos(angle);
    const p1y = cy + length * Math.sin(angle);
    const p2x = cx + (length - tipWidth) * Math.cos(angle) + width * Math.cos(angle + Math.PI / 2);
    const p2y = cy + (length - tipWidth) * Math.sin(angle) + width * Math.sin(angle + Math.PI / 2);
    const p3x = cx + (length - tipWidth) * Math.cos(angle + Math.PI) + width * Math.cos(angle + Math.PI / 2);
    const p3y = cy + (length - tipWidth) * Math.sin(angle + Math.PI) + width * Math.sin(angle + Math.PI / 2);
    const p4x = cx + length * Math.cos(angle + Math.PI);
    const p4y = cy + length * Math.sin(angle + Math.PI);
    const p5x = cx + (length - tipWidth) * Math.cos(angle + Math.PI) + width * Math.cos(angle - Math.PI / 2);
    const p5y = cy + (length - tipWidth) * Math.sin(angle + Math.PI) + width * Math.sin(angle - Math.PI / 2);
    const p6x = cx + (length - tipWidth) * Math.cos(angle) + width * Math.cos(angle - Math.PI / 2);
    const p6y = cy + (length - tipWidth) * Math.sin(angle) + width * Math.sin(angle - Math.PI / 2);

    return `M${p1x},${p1y}L${p2x},${p2y}L${p3x},${p3y}L${p4x},${p4y}L${p5x},${p5y}L${p6x},${p6y}Z`;
  }

  return (
    <div
      style={{
        background: "#fff",
        width: isFullWidth && legendBelowChart ? "90%" : "100%",
        margin: isFullWidth ? "0 auto" : "0",
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <Text>{t(p("CZFidelity"))}</Text>
      </div>
      <div
        style={{
          overflowX: legendBelowChart ? "auto" : "visible",
          ...(legendBelowChart
            ? {}
            : {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }),
        }}
      >
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <BackgroundGrid width={width} height={height} step={CZ_SCALE} />
          <g transform={`translate(${CZ_SCALE / 2},${CZ_SCALE / 2})`}>
            {cz.map((g) => {
              const [qa, qb] = g.Q;
              const a = coords?.[qa];
              const b = coords?.[qb];
              if (!a || !b) return null;

              const x1 = a.x * CZ_SCALE;
              const y1 = a.y * CZ_SCALE;
              const x2 = b.x * CZ_SCALE;
              const y2 = b.y * CZ_SCALE;

              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;

              const fidelity = g.Fidelity;
              const lineColor = color(fidelity);

              const pathD = orientedRightAngleHexagonPath(x1, y1, x2, y2, HEX_LENGTH, HEX_WIDTH, HEX_TIP_WIDTH);

              // 计算连线角度 (弧度)
              const angleRad = Math.atan2(y2 - y1, x2 - x1);
              // 转换为角度
              const angleDeg = (angleRad * 180) / Math.PI;

              // 检查连线是否接近垂直
              const isVertical = Math.abs(angleDeg) > 80 && Math.abs(angleDeg) < 100;

              // 确定文本的旋转角度
              let rotateAngle = 0;
              let dy = 0;

              if (isVertical) {
                // 垂直连线，旋转-90度使其从下到上显示
                rotateAngle = -90;
                dy = 3;
              } else {
                // 非垂直连线，保持水平
                dy = 3;
              }

              return (
                <g key={`${qa}-${qb}`}>
                  <path d={pathD} fill={lineColor} />
                  <text
                    x={mx}
                    y={my + dy}
                    textAnchor="middle"
                    fontSize={SZ_FONT_SIZE * 0.8}
                    fill="#fff"
                    transform={`rotate(${rotateAngle}, ${mx}, ${my})`}
                  >
                    {fidelity.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {Object.entries(coords).map(([qs, p]) => {
              const q = Number(qs);
              const cx = p.x * CZ_SCALE;
              const cy = p.y * CZ_SCALE;
              return (
                <g key={`n-${q}`}>
                  <circle cx={cx} cy={cy} r={CZ_NODE_R} fill="#6b7280" />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={SZ_FONT_SIZE}
                    fill="#fff"
                  >
                    {q}
                  </text>
                </g>
              );
            })}
          </g>
          {!legendBelowChart && (
            <g transform={`translate(${width + 28},0)`}>
              <ColorLegend
                id="czLegend"
                height={svgH - 50}
                color={color}
                domain={[minF, maxF]}
                format={(n) => n.toFixed(3)}
              />
            </g>
          )}
        </svg>
      </div>
      {legendBelowChart && (
        <div
          style={{
            marginTop: "16px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <svg width={window.innerWidth * 0.6 + 40} height={40}>
            <HorizontalColorLegend id="czLegend" color={color} domain={[minF, maxF]} format={(n) => n.toFixed(3)} />
          </svg>
        </div>
      )}
    </div>
  );
};
