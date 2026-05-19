import { Empty, Spin } from "antd";
import { scaleLinear } from "d3-scale";
import React from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Formatter } from "recharts/types/component/DefaultTooltipContent";
import { moneyNumberToString } from "src/utils/money";
import { styled } from "styled-components";

interface Props {
  isLoading: boolean;
  title: string;
  data: { x: string; y: string | number }[];
  xLabel?: string;
  toolTipFormatter?: Formatter<number | string, string>;
}

export const StatisticContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  height: 300px;
`;

export const StatisticTitle = styled.div<{ justify?: string }>`
  display: flex;
  margin: 8px 0;
`;

const CustomizedAxisTick = (props) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-35)">
        {payload.value}
      </text>
    </g>
  );
};

export const DataBarChart: React.FC<Props> = ({
  title,
  data,
  isLoading,
  xLabel = "",
  toolTipFormatter = (value) => value,
}) => {
  const tickFormatter = (value: number) => {
    const roundedValue = Number.isInteger(value) ? value : parseFloat(moneyNumberToString(value));
    return roundedValue.toString();
  };

  const min = Math.min(...data.map((d) => +d.y));
  const max = Math.max(...data.map((d) => +d.y));
  const [niceMin, niceMax] = scaleLinear().domain([min, max]).nice().domain();

  return (
    <StatisticContainer>
      {isLoading ? (
        <Spin />
      ) : (
        <>
          <StatisticTitle>{title}</StatisticTitle>
          {data.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer height="100%">
              <BarChart data={data}>
                <XAxis
                  dataKey="x"
                  padding={{ left: 20, right: 20 }}
                  label={{ value: xLabel, position: "insideBottom", offset: 0 }}
                  interval={0}
                  height={80}
                  tick={<CustomizedAxisTick />}
                />
                <YAxis padding={{ top: 20 }} tickFormatter={tickFormatter} domain={[niceMin, niceMax]} />
                <Tooltip formatter={toolTipFormatter} />
                <Bar dataKey="y" fill="#54a0ff" barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </StatisticContainer>
  );
};
