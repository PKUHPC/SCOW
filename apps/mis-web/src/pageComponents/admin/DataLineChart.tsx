import { Spin } from "antd";
import { scaleLinear } from "d3-scale";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Formatter } from "recharts/types/component/DefaultTooltipContent";
import { CurveType } from "recharts/types/shape/Curve";
import { styled } from "styled-components";

interface Props {
  isLoading: boolean;
  title: string;
  data: { x: string; y: string | number }[];
  lineType?: CurveType;
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

export const DataLineChart: React.FC<Props> = ({
  title,
  data,
  isLoading,
  lineType = "linear",
  toolTipFormatter = (value) => value,
}) => {
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
          <ResponsiveContainer height="100%">
            <LineChart data={data}>
              <XAxis dataKey="x" padding={{ left: 20, right: 20 }} type="category" />
              <YAxis domain={[niceMin, niceMax]} interval={"preserveStartEnd"} />
              <Tooltip formatter={toolTipFormatter} />
              <Line type={lineType} dataKey="y" stroke="#54a0ff" connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </StatisticContainer>
  );
};
