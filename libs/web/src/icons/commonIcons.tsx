/* eslint-disable @stylistic/max-len */

import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";
import { useTheme } from "styled-components";

/**
 * 工厂函数：创建一个带默认缩放的 Icon 组件
 * @param Svg - SVG 组件
 * @param defaultScale - 默认缩放（默认 0.9）
 */
export function createIcon(
  Svg: React.FC<React.SVGProps<SVGSVGElement>>,
  defaultScale: number = 0.9,
): React.ForwardRefExoticComponent<React.ComponentProps<typeof Icon>> {
  return React.forwardRef((props, ref: LegacyRef<HTMLSpanElement> | undefined) => {
    const { style, ...rest } = props;
    return <Icon component={Svg} ref={ref} {...rest} style={{ transform: `scale(${defaultScale})`, ...style }} />;
  });
}

// 问号
const questionMarkSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#888FA3" fillOpacity="0.15" />
    <path
      d="M8.81628 11.7637H7.64636V10.583H8.81628V11.7637ZM8.28699 4.15332C8.71353 4.15336 9.08 4.23359 9.3866 4.39355C9.69993 4.55355 9.93656 4.77371 10.0966 5.05371C10.2631 5.32695 10.3465 5.63999 10.3466 5.99316C10.3466 6.25983 10.3033 6.49336 10.2167 6.69336C10.13 6.88668 10.023 7.05027 9.89636 7.18359C9.77639 7.31685 9.61671 7.46725 9.41687 7.63379C9.18377 7.8336 9.00346 8.01297 8.87683 8.17285C8.75686 8.32615 8.68999 8.51657 8.67664 8.74316L8.64636 9.45312H7.80652L7.77625 8.81348C7.76292 8.56021 7.79687 8.33685 7.87683 8.14355C7.95682 7.94358 8.05355 7.77688 8.16687 7.64355C8.28687 7.50355 8.44326 7.34618 8.6366 7.17285C8.87648 6.95294 9.05356 6.76347 9.16687 6.60352C9.28685 6.43688 9.34654 6.24339 9.34656 6.02344C9.34656 5.75015 9.24978 5.52373 9.05652 5.34375C8.86323 5.15713 8.5935 5.06352 8.24695 5.06348C7.91372 5.06348 7.62345 5.15312 7.37683 5.33301C7.13689 5.5063 6.92382 5.76673 6.73718 6.11328L6.00671 5.58301C6.21334 5.13654 6.50986 4.78648 6.89636 4.5332C7.28303 4.27987 7.74699 4.15332 8.28699 4.15332Z"
      fill="#888FA3"
    />
  </svg>
);

export const QuestionMarkIcon = createIcon(questionMarkSVG);

// 下拉框的箭头
const selectionArrow = () => {
  const theme = useTheme();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="22" viewBox="0 0 24 22" fill="none">
      <path
        d="M16.8652 7.23438C17.1375 6.92217 17.5784 6.92217 17.8506 7.23438C18.1227 7.54659 18.1228 8.0521 17.8506 8.36426L12.0273 15.0439L6.2041 8.36426C5.93199 8.05212 5.93209 7.54658 6.2041 7.23438C6.47632 6.92217 6.91724 6.92217 7.18945 7.23438L12.0273 12.7822L16.8652 7.23438Z"
        fill={theme.palette.gray[5]}
      />
    </svg>
  );
};

export const selectionArrowIcon = createIcon(selectionArrow);

const doubleCircle = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="9" r="8.5" fill="transparent" stroke="currentColor" />
    <circle cx="9" cy="9" r="5" fill="currentColor" />
  </svg>
);

export const doubleCircleForTableIcon = createIcon(doubleCircle);

// 级联选择项中的箭头
const cascaderArrow = () => {
  const theme = useTheme();
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_6189_7037)">
        <rect width="24" height="22" rx="4" fill="transparent" />
        <path
          d="M0 6C0 2.68629 2.68629 0 6 0H18C21.3137 0 24 2.68629 24 6V16C24 19.3137 21.3137 22 18 22H6C2.68629 22 0 19.3137 0 16V6Z"
          fill="transparent"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M8.23415 6.18951C7.92195 5.91729 7.92195 5.47637 8.23415 5.20415C8.54637 4.93205 9.05188 4.93197 9.36404 5.20415L16.0437 11.0274L9.36404 16.8506C9.0519 17.1228 8.54636 17.1227 8.23415 16.8506C7.92195 16.5784 7.92195 16.1375 8.23415 15.8653L13.782 11.0274L8.23415 6.18951Z"
          fill={theme.palette.gray[5]}
        />
      </g>
      <defs>
        <clipPath id="clip0_6189_7037">
          <rect width="24" height="22" rx="4" fill="transparent" />
        </clipPath>
      </defs>
    </svg>
  );
};

export const cascaderArrowIcon = createIcon(cascaderArrow);

// 文件选择按钮
const file = () => {
  const theme = useTheme();
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_6879_17301)">
        <rect width="20" height="20" rx="4" fill="transparent" />
        <path
          d="M0 6C0 2.68629 2.68629 0 6 0H14C17.3137 0 20 2.68629 20 6V14C20 17.3137 17.3137 20 14 20H6C2.68629 20 0 17.3137 0 14V6Z"
          fill="transparent"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M6.84033 4.36035C7.25671 4.36051 7.65822 4.51018 7.97412 4.7793L7.9751 4.77832L8.88916 5.55762H15.2515C16.77 5.55787 18.0014 6.78906 18.0015 8.30762V13.8818C18.0015 15.4005 16.77 16.6316 15.2515 16.6318H4.88916C3.37041 16.6318 2.13916 15.4006 2.13916 13.8818V6.11035C2.13925 5.14393 2.92272 4.36035 3.88916 4.36035H6.84033ZM3.88916 5.86035C3.75114 5.86035 3.63925 5.97236 3.63916 6.11035V13.8818C3.63916 14.5722 4.1988 15.1318 4.88916 15.1318H15.2515C15.9416 15.1316 16.5015 14.572 16.5015 13.8818V8.30762C16.5014 7.61749 15.9416 7.05787 15.2515 7.05762H8.33643L8.12646 6.87891L7.00244 5.9209V5.91992C6.96835 5.89088 6.92704 5.87207 6.88428 5.86426L6.84033 5.86035H3.88916Z"
          fill={theme.palette.primary[6]}
        />
      </g>
      <defs>
        <clipPath id="clip0_6879_17301">
          <rect width="20" height="20" rx="4" fill="transparent" />
        </clipPath>
      </defs>
    </svg>
  );
};

export const fileIcon = createIcon(file);

// checkbox按钮
const check = () => {
  const theme = useTheme();
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="17"
        rx="3.5"
        fill={theme.palette.primary[6]}
        stroke={theme.palette.primary[6]}
      />
      <path d="M5 8.5L8 11.5L13 6" stroke="white" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
};

export const checkIcon = createIcon(check);

// 返回图标
const backSVG = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3.75L2.5 10L10 16.25" stroke="black" stroke-width="2" stroke-linecap="round" />
    <path d="M17.5 3.75L10 10L17.5 16.25" stroke="black" stroke-width="2" stroke-linecap="round" />
  </svg>
);

export const BackIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={backSVG} {...props} ref={ref} />,
);