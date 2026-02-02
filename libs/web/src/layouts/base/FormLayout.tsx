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

export const FormContainer = styled.div<{ $maxWidth: number }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: ${({ $maxWidth }) => $maxWidth}px;
  flex: 1;
`;

export const ChildrenContainer = styled.div`
  margin: 16px 0;
`;

type Props = React.PropsWithChildren<{
  maxWidth?: number;
}>;

export const FormLayout: React.FC<Props> = ({
  children,
  maxWidth = 600,
}) => {
  return (
    <FormContainer $maxWidth={maxWidth}>
      <ChildrenContainer>
        {children}
      </ChildrenContainer>
    </FormContainer>
  );
};
