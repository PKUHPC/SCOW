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

import React, { PropsWithChildren } from "react";
import styled from "styled-components";

interface Props {
  title: string;
}

const SubTitleContainer = styled.div`
  display: flex;
  align-items: center;
  height: 20px;
  margin: 30px 0;
`;

const Indicator = styled.div`
  width: 12px;
  height: 100%;
  background: #94070a;
`;

const TitleText = styled.div`
  font-size: 16px;
  margin-left: 5px;
`;

export const SubTitle: React.FC<PropsWithChildren<Props>> = ({ children, title }) => {
  return (
    <SubTitleContainer>
      <Indicator />
      <TitleText>{title}</TitleText>
      {children}
    </SubTitleContainer>
  );
};
