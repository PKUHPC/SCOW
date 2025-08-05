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

import React from "react";
import { styled } from "styled-components";

interface PieInfoProps {
  percentage: number;
  value: number;
  status: string;
  color: string;
}

const TextContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: ${({ color }) => color};

  .percentage {
    font-size: 2em;
  }

  .value {
    font-size: 1.5em;
  }

  .status {
    font-size: 1em;
  }
`;

const PieInfo: React.FC<PieInfoProps> = ({ percentage, value, status, color }) => {
  return (
    <TextContainer color={color}>
      <div className="percentage">{percentage}%</div>
      <div className="crossLine" style={{ height:"2px", backgroundColor:"#DEDEDE", width:"7.5em" }}></div>
      <div className="value">{value}</div>
      <div className="status">{status}</div>
    </TextContainer>
  );
};

export default PieInfo;


