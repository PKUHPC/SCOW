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

import { Card } from "antd";
import React from "react";
import { styled } from "styled-components";

type Props = React.PropsWithChildren<{
  title: React.ReactNode;
}>;

const Title = styled.h3`
  font-weight: 400;
`;

const ChildrenContainer = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  flex: 1;
`;


export const StatCard: React.FC<Props> = ({ children, title }) => {
  return (
    <Card
      style={{ height: "100%" }}
      styles={{
        body: { display: "flex", flexDirection: "column", height: "100%" },
      }}
    >
      <Title>
        {title}
      </Title>
      <ChildrenContainer>
        {children}
      </ChildrenContainer>
    </Card>
  );
};

