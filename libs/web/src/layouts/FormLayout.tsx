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

export const FormLayout: React.FC<Props> = ({ children, maxWidth = 600 }) => {
  return (
    <FormContainer $maxWidth={maxWidth}>
      <ChildrenContainer>{children}</ChildrenContainer>
    </FormContainer>
  );
};
