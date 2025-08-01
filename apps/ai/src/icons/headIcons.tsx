import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";

// 无消息图标
const noMessageSVG = () => (
  <svg width="13" height="16" viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M8.06959 2.01579C8.10573 1.8832 8.125 1.74382
          8.125 1.6C8.125 0.716344 7.39746 0 6.5 0C5.60254 0 4.875 0.716344 4.875 1.6C4.875 1.74382 4.89427
          1.8832 4.93041 2.01579C2.77573 2.64403 1.15839 4.53293 0.930383
          6.83049H0.902772V7.38995V7.53044V11.1025C0.370573 11.3418 0 11.8766 0 12.498C0 13.3426 0.684699
          14.0273 1.52932 14.0273H3.88428C4.19446 15.1636 5.24802 16 6.5 16C7.75198 16 8.80554 15.1636
          9.11572 14.0273H11.4707C12.3153 14.0273 13 13.3426 13 12.498C13 11.8766 12.6294 11.3418 12.0972
          11.1025V7.53044V7.38995V6.83049H12.0696C11.8416 4.53293 10.2243 2.64404 8.06959 2.01579Z"
      fill="currentColor"
    />
  </svg>
);

export const NoMessageIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={noMessageSVG} {...props} ref={ref} />
));

// 有消息图标
const messageSVG = () => (
  <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.5 0C7.39733 0 8.12479 0.716133 8.125 1.59961C8.125 1.74357 8.10359 1.88292 8.06738
          2.01562C10.2231 2.6433 11.8414 4.53263 12.0693 6.83105H12.0977V11.1035C12.6294 11.343 12.9999
          11.877 13 12.498C12.9999 13.3425 12.3152 14.0273 11.4707 14.0273H9.1123C8.8018 15.1632 7.75164
          16 6.5 16C5.24836 16 4.1982 15.1632 3.8877 14.0273H1.5293C0.684768 14.0273 0.00013028 13.3425 0
          12.498C5.95828e-05 11.877 0.370591 11.343 0.902344 11.1035V6.83105H0.930664C1.1586 4.53295 2.77637
          2.64357 4.93164 2.01562C4.89547 1.88299 4.875 1.74348 4.875 1.59961C4.87521 0.716133 5.60267 0 6.5 0Z"
      fill="currentColor"
    />
    <g filter="url(#filter0_d_145_1471)">
      <rect x="7" y="1" width="8" height="8" rx="4" fill="#FF4D4F" />
      <rect x="7.5" y="1.5" width="7" height="7" rx="3.5" stroke="white" />
    </g>
    <defs>
      <filter
        id="filter0_d_145_1471"
        x="7"
        y="1"
        width="8"
        height="8"
        filterUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_145_1471" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_145_1471" result="shape" />
      </filter>
    </defs>
  </svg>

);

export const MessageIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={messageSVG} {...props} ref={ref} />
));

// 用户图标
const userSVG = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8 0C12.4183 0 16 3.64749 16 8.14648C15.9999 10.4444 15.0636 12.5181 13.5605
          13.999C12.6697 11.7616 10.5169 10.1826 8 10.1826C5.48296 10.1826 3.32921 11.7614 2.43848
          13.999C0.935734 12.5181 9.04748e-05 10.4441 0 8.14648C0 3.64749 3.58172 0 8 0ZM8 3.05469C6.34322
          3.05469 5.00012 4.42236 5 6.10938C5 7.7965 6.34315 9.16406 8 9.16406C9.65685 9.16406 11 7.7965
          11 6.10938C10.9999 4.42236 9.65678 3.05469 8 3.05469Z"
      fill="currentColor"
    />
  </svg>

);

export const UserIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={userSVG} {...props} ref={ref} />
));

// 收起菜单图标
const collapseMenuSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="18" height="18" rx="4" fill="black" />
    <path d="M10.125 5.625L6.75 9L10.125 12.375" stroke="white" stroke-width="1.2" stroke-linecap="round" />
  </svg>

);

export const CollapseMenuIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={collapseMenuSVG} {...props} ref={ref} />
));

// 展开菜单图标
const expandMenuSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="18" width="18" height="18" rx="4" transform="rotate(-180 18 18)" fill="black" />
    <path d="M7.875 12.375L11.25 9L7.875 5.625" stroke="white" stroke-width="1.2" stroke-linecap="round" />
  </svg>
);

export const ExpandMenuIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={expandMenuSVG} {...props} ref={ref} />
));

