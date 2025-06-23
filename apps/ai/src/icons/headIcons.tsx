import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";

// 高性能计算图标
const highComputingSVG = () => (
  <svg width="18" height="17" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.0332 0.0595703C12.3091 0.0597012 12.533 0.283677 12.5332 0.55957V1.79883C14.1936
          1.90194 15.579 3.01765 16.0801 4.53613H17.4961C17.7721 4.53613 17.9958 4.76021 17.9961
          5.03613C17.9961 5.31228 17.7722 5.53613 17.4961 5.53613H16.2725C16.2777 5.62011 16.2812 5.70473
          16.2812 5.79004V7.55859H17.4961C17.772 7.55869 17.9958 7.78273 17.9961 8.05859C17.9961 8.33468
          17.7722 8.5585 17.4961 8.55859H16.2812V10.3271C16.2812 10.4123 16.2777 10.4972 16.2725
          10.5811H17.4961C17.772 10.5812 17.9959 10.8051 17.9961 11.0811C17.9961 11.3571 17.7722 11.581
          17.4961 11.5811H16.0801C15.5791 13.0999 14.1938 14.2152 12.5332 14.3184V15.5586C12.5331 15.8345
          12.3091 16.0583 12.0332 16.0586C11.7573 16.0584 11.5333 15.8346 11.5332
          15.5586V14.3271H9.49805V15.5586C9.49798 15.8346 9.27404 16.0585 8.99805 16.0586C8.72211 16.0584
          8.49811 15.8346 8.49805 15.5586V14.3271H6.46289V15.5586C6.46282 15.8346 6.23894 16.0585 5.96289
          16.0586C5.68696 16.0584 5.46296 15.8346 5.46289 15.5586V14.3184C3.80242 14.2154 2.41728 13.1005
          1.91602 11.582H0.5C0.224007 11.582 0.000242072 11.358 0 11.082C-4.90924e-09 10.8059 0.223858 10.582
          0.5 10.582H1.72363C1.71834 10.4978 1.71387 10.4127 1.71387 10.3271V8.55957H0.5C0.224117 8.55944
          0.000242057 8.33543 0 8.05957C-4.90821e-09 7.78351 0.223968 7.5597 0.5 7.55957H1.71387V5.79004C1.71387
          5.70505 1.7184 5.62078 1.72363 5.53711H0.5C0.224076 5.53698 0.000176209 5.31302 0 5.03711C-4.90821e-09
          4.76105 0.223968 4.53724 0.5 4.53711H1.91504C2.41592 3.01795 3.80189 1.90178 5.46289 1.79883V0.55957C5.46309
          0.283678 5.68698 0.059703 5.96289 0.0595703C6.23891 0.0595703 6.46269 0.283596 6.46289
          0.55957V1.79004H8.49805V0.55957C8.49824 0.283638 8.72208 0.0596382 8.99805 0.0595703C9.27407 0.0595703
          9.49785 0.283596 9.49805 0.55957V1.79004H11.5332V0.55957C11.5334 0.283638 11.7572 0.059638 12.0332
          0.0595703ZM6.1416 4.14062C5.03744 4.14092 4.14187 5.03646 4.1416 6.14062V9.97656C4.1416 11.081 5.03728
          11.9763 6.1416 11.9766H11.8535C12.9581 11.9766 13.8535 11.0811 13.8535 9.97656V6.14062C13.8533 5.03628
          12.9579 4.14062 11.8535 4.14062H6.1416ZM11.0449 5.03711C12.1495 5.03712 13.0449 5.93255 13.0449
          7.03711V9.08105C13.0449 10.1856 12.1495 11.081 11.0449 11.0811H6.95117C5.84682 11.0808 4.95117 10.1855
          4.95117 9.08105V7.03711C4.95117 5.9327 5.84682 5.03736 6.95117 5.03711H11.0449Z"
      fill="currentColor"
    />
  </svg>

);

export const HighComputingIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={highComputingSVG} {...props} ref={ref} />
));

// 人工智能图标
const aiSVG = () => (
  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 14.499C12.4142 14.499 12.7499 14.8349 12.75 15.249C12.75 15.6632 12.4142 15.999
          12 15.999H6C5.58579 15.999 5.25 15.6632 5.25 15.249C5.25007 14.8349 5.58583 14.499 6 14.499H12ZM14
          0C16.2091 0 18 1.79086 18 4V9C18 11.2091 16.2091 13 14 13H4C1.79086 13 8.05332e-08 11.2091 0
          9V4C0 1.79086 1.79086 1.61064e-08 4 0H14ZM6.05762 4.29199C5.36084 4.29199 4.79609 4.89902 4.7959
          5.64746C4.7959 6.39608 5.36072 7.00293 6.05762 7.00293C6.75435 7.00272 7.31934 6.39595 7.31934
          5.64746C7.31914 4.89915 6.75423 4.2922 6.05762 4.29199ZM11.9434 4.29199C11.2468 4.29224 10.6818
          4.89918 10.6816 5.64746C10.6816 6.39592 11.2467 7.00268 11.9434 7.00293C12.6403 7.00293 13.2061
          6.39608 13.2061 5.64746C13.2059 4.89902 12.6401 4.29199 11.9434 4.29199Z"
      fill="currentColor"
    />
  </svg>
);

export const AiIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={aiSVG} {...props} ref={ref} />
));

// 管理系统图标
const misSVG = () => (
  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13.0433 0C13.8163 6.32896e-05 14.5202 0.445918 14.851 1.14453L17.8012 7.37988C18.0652
          7.93793 18.0572 8.58672 17.7787 9.1377L14.8646 14.9023C14.5243 15.5755 13.8338 16 13.0795
          16H5.18007C4.45156 15.9999 3.7809 15.6038 3.42909 14.9658L0.248425 9.19922C-0.0736775 8.61508
          -0.083919 7.90817 0.222058 7.31543L3.43983 1.08301C3.78304 0.41823 4.46905 0.000100327 5.21718
          0H13.0433Z"
      fill="currentColor"
    />
    <path
      d="M11.7623 7.07884C12.0147 7.62635 12.0066 8.2585 11.7404 8.79942L11.3535 9.58538C11.017
          10.2691 10.3212 10.7021 9.55913 10.7021H8.42301C7.68634 10.7021 7.0093 10.2972 6.66087
          9.64811L6.23786 8.86013C5.92968 8.28605 5.92046 7.59783 6.21317 7.01571L6.67282 6.10155C7.0124
          5.42619 7.70374 5 8.45966 5H9.52359C10.304 5 11.0131 5.45393 11.3399 6.16265L11.7623 7.07884Z"
      fill="white"
    />
  </svg>
);

export const MisIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={misSVG} {...props} ref={ref} />
));

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
