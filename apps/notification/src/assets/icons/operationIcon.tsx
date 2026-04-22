import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";
import { styled } from "styled-components";

interface IconProps {
  onClick?: (e: any) => void;
}

export const IconContainer = styled.div`
  height: 24px;
  width: 22px;
  display: flex;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: ${({ theme }) => theme.token.colorPrimary };
  &:hover {
    background: ${({ theme }) => theme.palette?.primary?.[0] ?? "#B6000314"};
  }
`;

// 删除图标
const deleteSVG = () => (
  <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.7041 2.51086C10.7128 2.61313 11.5 3.46448 11.5 4.50012V12.5001L11.4893 12.7042C11.3937
      13.6457 10.6456 14.3939 9.7041 14.4894L9.5 14.5001H2.5C1.46439 14.5001 0.613062 13.7128 0.510742
      12.7042L0.5 12.5001V4.50012C0.5 3.39555 1.39543 2.50012 2.5 2.50012H9.5L9.7041 2.51086ZM2.5
      3.70032C2.05817 3.70032 1.7002 4.05829 1.7002 4.50012V12.5001C1.70026 12.9419 2.05821 13.2999 2.5
      13.2999H9.5C9.94179 13.2999 10.2997 12.9419 10.2998 12.5001V4.50012C10.2998 4.05829 9.94183 3.70032
      9.5 3.70032H2.5ZM4.5 5.90051C4.83137 5.90051 5.09961 6.16875 5.09961 6.50012V11.5001C5.09954 11.8314
      4.83133 12.0997 4.5 12.0997C4.16867 12.0997 3.90046 11.8314 3.90039 11.5001V6.50012C3.90039 6.16875
      4.16863 5.90051 4.5 5.90051ZM7.5 5.90051C7.83137 5.90051 8.09961 6.16875 8.09961 6.50012V11.5001C8.09954
      11.8314 7.83133 12.0997 7.5 12.0997C7.16867 12.0997 6.90046 11.8314 6.90039 11.5001V6.50012C6.90039
      6.16875 7.16863 5.90051 7.5 5.90051ZM10 0.400513C10.3314 0.400513 10.5996 0.668751 10.5996
      1.00012C10.5995 1.33144 10.3313 1.59973 10 1.59973H2C1.66867 1.59973 1.40046 1.33144 1.40039
      1.00012C1.40039 0.668751 1.66863 0.400513 2 0.400513H10Z"
      fill="currentColor"
    />
  </svg>
);

export const DeleteIcon: React.ForwardRefExoticComponent<IconProps> =
  React.forwardRef((props, ref: LegacyRef<HTMLSpanElement> | undefined) => (
    <IconContainer>
      <Icon component={deleteSVG} {...props} ref={ref} />
    </IconContainer>
  ));
