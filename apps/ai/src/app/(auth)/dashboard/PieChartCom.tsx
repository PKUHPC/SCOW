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

import React, { useEffect, useState } from "react";
import { styled } from "styled-components"; ;
import { Cell, Pie, PieChart, Sector } from "recharts";

import PieInfo from "./PieInfo";

interface Props {
  pieData: PieData[];
  range: number;
  display: boolean;
  total: number;
}

interface PieData {
  value: number;
  color: string;
  itemName: string;
}

const Container = styled.div`
  position: relative;
  width: 230px;  /* 容器宽度应与饼图宽度一致 */
  height: 230px;  /* 容器高度应与饼图高度一致 */
`;

const JobRange = styled.div`
  position: absolute;  /* 需要使用 absolute 定位 */
  width: max-content;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);  /* 确保其完全居中 */
`;

// 鼠标交互时cell 的渲染组件
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 5} // 缩小内半径
        outerRadius={outerRadius + 5} // 增大外半径
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={"2px"}
      />
    </g>
  );
};

export const PieChartCom: React.FC<Props> = ({ pieData, display, total }) => {

  // 没有值的时候不显示
  if (!display) {
    return null;
  }

  // 鼠标激活index的value
  const [hoveredValue, setHoveredValue] = useState<number>(pieData[1].value);

  // 鼠标激活的index
  const [activeIndex, setActiveIndex] = useState<number>(1);

  // 饼图内文字颜色
  const pieInfoColor = "#6B747F";

  // 当 pieData 或 total 发生变化时，更新 hoveredValue 和 activeIndex
  useEffect(() => {
    setHoveredValue(pieData[1].value);
    setActiveIndex(1);
  }, [pieData, total]);


  return (
    <Container>
      <JobRange style={{ display:`${total === 0 ? "none" : "unset"}` }}>
        <PieInfo
          percentage={Math.min(Math.round((hoveredValue / total) * 100), 100)}
          value={hoveredValue}
          status={pieData[activeIndex].itemName}
          color={pieInfoColor}
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
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              stroke={"none"}
            />
          ))}
        </Pie>
      </PieChart>
    </Container>
  );
};
