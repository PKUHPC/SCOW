import { styled } from "styled-components";

export const TableTitle = styled.div<{ justify?: string }>`
  display: flex;
  justify-content: ${(p) => p.justify ?? "flex-end"};
  margin: 8px 0;
`;
