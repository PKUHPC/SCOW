import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";
import { PieInfo } from "src/features/dashboard/components/PieInfo";
import { styled } from "styled-components";

interface PieData {
  value: number;
  color: string;
  itemName: string;
}

interface Props {
  pieData: PieData[];
  display: boolean;
  total: number;
}

const Container = styled.div`
  position: relative;
  width: 230px;
  height: 230px;
`;

const JobRange = styled.div`
  position: absolute;
  width: max-content;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const renderActiveShape = (props: React.ComponentProps<typeof Sector>) => (
  <g>
    <Sector
      {...props}
      innerRadius={Number(props.innerRadius) - 5}
      outerRadius={Number(props.outerRadius) + 5}
      stroke="#fff"
      strokeWidth="2px"
    />
  </g>
);

export function PieChartCom({ pieData, display, total }: Props) {
  const [hoveredValue, setHoveredValue] = useState(pieData[1].value);
  const [activeIndex, setActiveIndex] = useState(1);

  useEffect(() => {
    setHoveredValue(pieData[1].value);
    setActiveIndex(1);
  }, [pieData, total]);

  if (!display) return null;

  return (
    <Container>
      <JobRange style={{ display: total === 0 ? "none" : "unset" }}>
        <PieInfo
          percentage={Math.min(Math.round((hoveredValue / total) * 100), 100)}
          value={hoveredValue}
          status={pieData[activeIndex].itemName}
          color="#6B747F"
        />
      </JobRange>
      <PieChart width={230} height={230}>
        <Pie
          data={pieData}
          cx={105}
          cy={110}
          innerRadius={70}
          outerRadius={95}
          dataKey="value"
          stroke="none"
          onMouseEnter={(data, index) => {
            setHoveredValue(data.value);
            setActiveIndex(index);
          }}
          onMouseLeave={() => {
            setHoveredValue(pieData[1].value);
            setActiveIndex(1);
          }}
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
          ))}
        </Pie>
      </PieChart>
    </Container>
  );
}
