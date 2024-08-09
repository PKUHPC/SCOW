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

import { Empty, Spin } from "antd";
import React from "react";
import { Bar, BarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Formatter } from "recharts/types/component/DefaultTooltipContent";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

interface Props {
  isLoading: boolean
  title: string
  data: { x: string, y: string | number }[]
  xLabel?: string
  toolTipFormatter?: Formatter<number | string, string>
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
    const roundedValue = Number.isInteger(value) ? value : parseFloat(value.toFixed(publicConfig.CHARGE_PRECISION));
    return roundedValue.toString();
  };

  return (
    <StatisticContainer>
      {isLoading ? <Spin /> : (
        <>
          <StatisticTitle>{ title }</StatisticTitle>
          {data.length === 0 ?
            <Empty />
            : (
              <ResponsiveContainer height="100%">
                <BarChart
                  data={data}
                >
                  <XAxis
                    dataKey="x"
                    padding={{ left: 20, right: 20 }}
                    label={{ value: xLabel, position: "insideBottom", offset: 0 }}
                    interval={0}
                    height={ 80 }
                    tick={<CustomizedAxisTick /> }
                  />
                  <YAxis padding={{ top: 20 }} tickFormatter={tickFormatter} />
                  <Tooltip
                    formatter={toolTipFormatter}
                  />
                  <Bar dataKey="y" fill="#54a0ff" barSize={ 40 } />
                </BarChart>
              </ResponsiveContainer>
            )}
        </>
      )}
    </StatisticContainer>

  );

};
