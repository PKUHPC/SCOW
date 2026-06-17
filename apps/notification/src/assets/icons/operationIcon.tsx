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
  color: ${({ theme }) => theme.token.colorPrimary};
  &:hover {
    background: ${({ theme }) => theme.palette?.primary?.[0] ?? "#B6000314"};
  }
`;

// 删除图标
const deleteSVG = () => (
  <svg width="24" height="22" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_4688_4012)">
      <path
        d="M17.5459 7.49805C17.8769 7.49831 18.1453 7.76663 18.1455 8.09766C18.1455 8.42886 17.877 8.697 17.5459 8.69727H16.1992V14.5996C16.1992
        16.0356 15.0356 17.1992 13.5996 17.1992H9.59961C8.16367 17.1992 7 16.0356 7 14.5996V8.69727H5.59961C5.26831 8.69719 5 8.42898 5
        8.09766C5.00021 7.76652 5.26844 7.49813 5.59961 7.49805H17.5459ZM8.19922 8.69727V14.5996C8.19922 15.3728 8.82641 16 9.59961 16H13.5996C14.3728
        16 15 15.3728 15 14.5996V8.69727H8.19922ZM10.3154 10.4766C10.5914 10.4767 10.8154 10.7005 10.8154 10.9766V14.0801C10.815 14.3557 10.5912 14.5799
        10.3154 14.5801C10.0397 14.5799 9.81586 14.3558 9.81543 14.0801V10.9766C9.81543 10.7005 10.0394 10.4767 10.3154 10.4766ZM12.8311 10.4766C13.1068
        10.477 13.3311 10.7007 13.3311 10.9766V14.0801C13.3306 14.3556 13.1066 14.5796 12.8311 14.5801C12.5552 14.5801 12.3315 14.3559 12.3311 14.0801V10.9766C12.3311
        10.7004 12.5549 10.4766 12.8311 10.4766ZM14.7158 5C15.0472 5 15.3164 5.26824 15.3164 5.59961C15.3161 5.93076 15.047 6.19922 14.7158 6.19922H8.42871C8.09762
        6.19908 7.82936 5.93067 7.8291 5.59961C7.8291 5.26832 8.09746 5.00014 8.42871 5H14.7158Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

export const DeleteIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => (
    <IconContainer>
      <Icon component={deleteSVG} {...props} ref={ref} />
    </IconContainer>
  ),
);
