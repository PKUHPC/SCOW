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

// 标题容器
const Container = styled.div`
  width:100%;
  display:flex;
  justify-content: space-between;
`;
// 标题
const Title = styled.div`
  font-size:1em;
  width:max-content;
`;
// 副标题容器
const SubContainer = styled.div`
  display:flex;
  font-weight:400;
  font-size:1em;
  width:max-content;
`;

interface Props {
  // 总共节点
  total: number,
  // 可用节点
  available: number,
  // 标题名称
  name: string,
  // 是否显示
  display: boolean,
  // 副标题名称
  subName: string
}


export const TitleContainer: React.FC<Props> = ({ total, name, display, subName }) => {

  // 没有数据的时候不显示
  if (!display) {
    return null;
  }

  return (
    <Container>
      <Title>{name}</Title>

      <SubContainer>
        <Title style={{ marginRight:"0.35em" }}>{subName}</Title>
        {/* <Title style={{ color:"#45A922" }}>{available.toFixed(0)}</Title> */}
        <Title>{total.toFixed(0)}</Title>
      </SubContainer>

    </Container>
  );

};
