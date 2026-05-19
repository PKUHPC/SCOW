import { scaleLinear } from "d3-scale";
import React from "react";
import { getNiceTicks } from "src/pageComponents/chip/ColorLegend";

interface Props {
  id: string;
  domain: [number, number];
  format: (n: number) => string;
  color: (t: number) => string;
}

export const HorizontalColorLegend: React.FC<Props> = ({ id, domain, format, color }) => {
  const [minVal, maxVal] = domain;
  const { ticks, niceMin, niceMax } = getNiceTicks(minVal, maxVal, 2, 6);

  const domainMin = niceMin;
  const domainMax = niceMax === niceMin ? niceMin + 0.1 : niceMax;
  const rangeSpan = domainMax - domainMin;

  const legendHeight = 20;
  const legendWidth = window.innerWidth * 0.6;
  const PADDING = 20;
  const svgWidth = legendWidth + PADDING * 2;
  const svgHeight = legendHeight + PADDING * 2;

  const horizontalScale = scaleLinear()
    .domain([domainMin, domainMax])
    .range([PADDING, legendWidth + PADDING]);

  return (
    <svg width={svgWidth} height={svgHeight}>
      <g>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            {ticks
              .slice()
              .sort((a, b) => a - b)
              .map((t) => {
                const offsetPct = rangeSpan === 0 ? 0 : ((t - domainMin) / rangeSpan) * 100;
                return <stop key={String(t)} offset={`${offsetPct}%`} stopColor={color(t)} />;
              })}
          </linearGradient>
        </defs>

        {/* 调整 rect 的 x 坐标，使其从 PADDING 处开始 */}
        <rect x={PADDING} width={legendWidth} height={legendHeight} fill={`url(#${id})`} />

        <g transform={`translate(0, ${legendHeight + 4})`}>
          {ticks.map((tick) => {
            const xPos = horizontalScale(tick);
            return (
              <g key={`tick-${tick}`} transform={`translate(${xPos}, 0)`}>
                <line x1="0" y1="0" x2="0" y2="4" stroke="#374151" strokeWidth={1} />
                <text y="14" fontSize={12} textAnchor="middle" fill="#374151">
                  {format(tick)}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
};
