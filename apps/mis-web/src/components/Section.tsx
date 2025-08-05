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

import { Typography } from "antd";
import React from "react";
import { styled } from "styled-components";

type Props = React.PropsWithChildren<{
  title: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}>;

const Container = styled.div`
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TitleText = styled(Typography.Title)`
&& {
  font-size: 24px;
}
`;

export const Section: React.FC<Props> = ({ title, extra, children, className }) => {

  return (
    <Container className={className}>
      <Title>
        <TitleText>
          {title}
        </TitleText>
        {extra}
      </Title>
      {children}
    </Container>
  );
};
