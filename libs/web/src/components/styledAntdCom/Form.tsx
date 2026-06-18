import { Typography } from "antd";
import { styled } from "styled-components";

export const FormLabel = styled(Typography.Text)`
  font-weight: lighter !important;
  color: ${({ theme }) => theme.palette.gray[8]} !important;
`;
