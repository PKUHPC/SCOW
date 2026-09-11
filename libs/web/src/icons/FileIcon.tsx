import Icon from "@ant-design/icons";
import React, { LegacyRef, Ref, useId } from "react";
import styled from "styled-components";


interface IconProps {
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}

export const IconContainer = styled.div`
  height: 24px;
  width: 22px;
  display: flex;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: ${({ theme }) => theme.token.colorPrimary};
`;

export const DisableIconContainer = styled.div`
  height: 24px;
  width: 22px;
  display: flex;
  justify-content: center;
  color: #8c8c8c;
`;

export const CustomIcon = styled(Icon)`
  flex: 1;
  justify-content: center;
`;

const FreshIconContainer = styled(IconContainer)`
  color: inherit;
`;


// 定义图标组件的接口以接受样式属性

// 文件夹的SVG
const folderSVG = () => {
  const gradientId = useId();

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 11V14C8 14.5523 8.44772 15 9 15H16.0223C16.5623 15 17 14.5623 17 14.0223C17 13.736 16.8745
      13.4641 16.6567 13.2783L13.0924 10.2391C12.9114 10.0848 12.6814 10 12.4436 10H9C8.44772 10 8 10.4477
      8 11Z"
        fill="#FFBF00"
      />
      <path
        d="M8 20V14C8 12.8954 8.89543 12 10 12H22C23.1046 12 24 12.8954 24 14V20C24 21.1046 23.1046 22 22
      22H10C8.89543 22 8 21.1046 8 20Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient id={gradientId} x1="16" y1="12" x2="16" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE600" />
          <stop offset="1" stopColor="#FFBF00" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const FolderIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={folderSVG} {...props} ref={ref} />,
);

// 压缩包的SVG
const archiveSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 10.9258H15.9258V10H22C23.1044 10.0002 24 10.8955 24 12V20C24 21.1045 23.1044 21.9998 22 22H10C8.89558
      21.9998 8 21.1045 8 20V12C8 10.8955 8.89558 10.0002 10 10H15V10.9258ZM15 15V19H17V15H15ZM15
      14.9258H15.9258V14H15V14.9258ZM16 13.9258H16.9258V13H16V13.9258ZM15 12.9258H15.9258V12H15V12.9258ZM16
      11.9258H16.9258V11H16V11.9258Z"
      fill="url(#paint0_linear_18_1040)"
    />
    <defs>
      <linearGradient id="paint0_linear_18_1040" x1="16" y1="10" x2="16" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34B1FF" />
        <stop offset="1" stopColor="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const ArchiveIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={archiveSVG} {...props} ref={ref} />,
);

// 软链接的SVG
const symlinkSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.2686 18.7676C17.4638 18.9628 17.4638 19.2793 17.2686 19.4746L16.0303 20.7129L15.9092 20.8291C15.6199
      21.0918 15.2876 21.3037 14.9277 21.4561C14.5166 21.6301 14.0764 21.7225 13.6318 21.7275C13.1872 21.7325
      12.7464 21.6505 12.3359 21.4844C11.9255 21.3182 11.5528 21.0713 11.2402 20.7588C10.9279 20.4464 10.6818
      20.0742 10.5156 19.6641C10.3494 19.2535 10.2665 18.812 10.2715 18.3672C10.2766 17.9227 10.3689 17.4824
      10.543 17.0713C10.7171 16.6602 10.9699 16.286 11.2861 15.9697L12.5244 14.7305C12.7197 14.5352 13.0372
      14.5352 13.2324 14.7305C13.4273 14.9257 13.4273 15.2423 13.2324 15.4375L11.9932 16.6768C11.7677 16.9024
      11.5876 17.1688 11.4639 17.4609C11.3401 17.7532 11.2741 18.0656 11.2705 18.3789C11.267 18.6923 11.3263
      19.0014 11.4424 19.2881C11.5584 19.5747 11.7299 19.8343 11.9473 20.0518C12.1647 20.2692 12.4243 20.4415
      12.7109 20.5576C12.9976 20.6736 13.3068 20.732 13.6201 20.7285C13.9335 20.725 14.2457 20.6589 14.5381
      20.5352C14.7572 20.4423 14.9626 20.3175 15.1465 20.166L15.3232 20.0059L16.5615 18.7676C16.7568 18.5723
      17.0733 18.5724 17.2686 18.7676ZM18.1406 13.8584C18.3357 14.0536 18.3356 14.3702 18.1406 14.5654L14.8379
      17.8691C14.6427 18.0641 14.3261 18.064 14.1309 17.8691C13.9357 17.674 13.9358 17.3574 14.1309 17.1621L17.4336
      13.8584C17.6288 13.6635 17.9454 13.6634 18.1406 13.8584ZM22 13.3604C21.9897 14.2581 21.6229 15.1202 20.9844
      15.7588L19.7461 16.9971L19.6689 17.0615C19.4748 17.19 19.21 17.1681 19.0391 16.9971C18.8682 16.8261 18.8472
      16.5622 18.9756 16.3682L19.0391 16.29L20.2773 15.0518C20.7335 14.5956 20.9928 13.9819 21 13.3486C21.0071 12.716
      20.7629 12.1147 20.3242 11.6758C19.8852 11.2368 19.2833 10.9929 18.6504 11C18.3371 11.0036 18.0247 11.0686
      17.7324 11.1924C17.4404 11.3162 17.1738 11.4963 16.9482 11.7217L15.71 12.96C15.5148 13.1551 15.1982 13.1549
      15.0029 12.96C14.8077 12.7647 14.8077 12.4482 15.0029 12.2529L16.2402 11.0146C16.5567 10.6982 16.9324 10.4457
      17.3437 10.2715C17.7549 10.0974 18.1951 10.005 18.6396 10C19.5381 9.98992 20.3996 10.3371 21.0312 10.9687C21.6627
      11.6004 22.0101 12.462 22 13.3604Z"
      fill="url(#paint0_linear_18_1041)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_18_1041"
        x1="22"
        y1="15.864"
        x2="10.2711"
        y2="15.864"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#34B1FF" />
        <stop offset="1" stopColor="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const SymlinkIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={symlinkSVG} {...props} ref={ref} />,
);

// 支持的文件的SVG
const supportedFileSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16.2002 9C16.7524 9.00004 17.2002 9.44774 17.2002 10V12.667C17.2004 13.2191 17.648 13.667 18.2002
      13.667H21C21.5523 13.667 22 14.1147 22 14.667V22C22 22.5523 21.5523 23 21 23H11C10.4478 22.9999 10 22.5522 10
      22V10C10 9.44775 10.4478 9.00006 11 9H16.2002ZM13.0469 19.7246C12.8262 19.7248 12.6466 19.9043 12.6465
      20.125C12.6465 20.3457 12.8262 20.5252 13.0469 20.5254H16.8555C17.0764 20.5254 17.2558 20.3459 17.2559
      20.125C17.2557 19.9042 17.0763 19.7246 16.8555 19.7246H13.0469ZM13.0459 17.3623C12.8252 17.3626 12.6455 17.542
      12.6455 17.7627C12.6455 17.9834 12.8252 18.1628 13.0459 18.1631H18.8447C19.0656 18.1631 19.2451 17.9836 19.2451
      17.7627C19.2451 17.5418 19.0656 17.3623 18.8447 17.3623H13.0459ZM17.958 9.80371C17.9581 9.18029 18.7113 8.8681
      19.1523 9.30859L21.6484 11.8047C22.0893 12.2456 21.7776 12.9996 21.1543 13H18.6582C18.2716 13 17.958 12.6864
      17.958 12.2998V9.80371Z"
      fill="url(#paint0_linear_18_1043)"
    />
    <defs>
      <linearGradient id="paint0_linear_18_1043" x1="16" y1="9" x2="16" y2="23.1748" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34B1FF" />
        <stop offset="1" stopColor="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const SupportedFileIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={supportedFileSVG} {...props} ref={ref} />,
);

// 图片SVG
const imageSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 10C23.1044 10.0002 24 10.8955 24 12V20C24 21.1045 23.1044 21.9998 22 22H10C8.89558 21.9998 8
      21.1045 8 20V12C8 10.8955 8.89558 10.0002 10 10H22ZM13.6064 16.1035C13.4319 16.04 13.2361 16.0781 13.0986
      16.2031L9.88574 19.1299C9.54805 19.4375 9.76588 20 10.2227 20H21.4678C22.0268 19.9998 22.1645 19.222
      21.6396 19.0303L13.6064 16.1035ZM20 13C19.4477 13 19 13.4477 19 14C19 14.5523 19.4477 15 20 15C20.5523
      15 21 14.5523 21 14C21 13.4477 20.5523 13 20 13Z"
      fill="url(#paint0_linear_18_1042)"
    />
    <defs>
      <linearGradient id="paint0_linear_18_1042" x1="16" y1="10" x2="16" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34B1FF" />
        <stop offset="1" stopColor="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const ImageIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef(
  (props, ref: LegacyRef<HTMLSpanElement> | undefined) => <Icon component={imageSVG} {...props} ref={ref} />,
);

// 未识别文件的SVG
const unrecognizedFileSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16.2002 9C16.7524 9.00004 17.2002 9.44774 17.2002 10V12.667C17.2004 13.2191 17.648 13.667 18.2002
      13.667H21C21.5523 13.667 22 14.1147 22 14.667V22C22 22.5523 21.5523 23 21 23H11C10.4478 22.9999 10 22.5522
      10 22V10C10 9.44775 10.4478 9.00006 11 9H16.2002ZM17.958 9.80371C17.9581 9.18029 18.7113 8.8681 19.1523
      9.30859L21.6484 11.8047C22.0893 12.2456 21.7776 12.9996 21.1543 13H18.6582C18.2716 13 17.958 12.6864 17.958
      12.2998V9.80371Z"
      fill="url(#paint0_linear_397_264)"
    />
    <defs>
      <linearGradient id="paint0_linear_397_264" x1="16" y1="9" x2="16" y2="23.1748" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E4E4E4" />
        <stop offset="1" stopColor="#A5A5A5" />
      </linearGradient>
    </defs>
  </svg>
);

export const UnrecognizedFileIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={unrecognizedFileSVG} {...props} ref={ref} />
));

// 文件管理相关图标
// 快捷路径收缩
const entryPathsCollapseSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="18" viewBox="0 0 16 18" fill="none">
    <g clipPath="url(#clip0_6299_791)">
      <rect x="7.86805e-07" y="18" width="18" height="16" rx="4" transform="rotate(-90 7.86805e-07 18)" fill="none" />
      <path d="M6 18C2.68629 18 6.69383e-07 15.3137 5.24536e-07 12L2.62268e-07 6C1.17421e-07 2.68629 2.68629 5.81961e-07 6 4.37114e-07L10 2.62268e-07C13.3137 1.17422e-07 16 2.68629 16 6L16 12C16 15.3137 13.3137 18 10 18L6 18Z" fill="none" />
      <path fillRule="evenodd" clipRule="evenodd" d="M10.7094 12.6621C11.0174 12.9391 11.0174 13.3881 10.7094 13.665C10.4014 13.9418 9.90212 13.9419 9.59419 13.665L4.59028 9.16601L9.59419 4.66601C9.90205 4.38919 10.4014 4.38946 10.7094 4.66601C11.0174 4.94296 11.0174 5.39199 10.7094 5.66894L6.82075 9.16601L10.7094 12.6621Z" fill="#595959" />
    </g>
    <defs>
      <clipPath id="clip0_6299_791">
        <rect x="7.86805e-07" y="18" width="18" height="16" rx="4" transform="rotate(-90 7.86805e-07 18)" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const EntryPathsCollapseIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={entryPathsCollapseSVG} {...props} ref={ref} />
));
// 快捷路径展开
const entryPathsExpandSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="7" height="10" viewBox="0 0 7 10" fill="none">
    <path d="M0.230861 1.21036C-0.0768416 0.933383 -0.0770461 0.484291 0.230861 0.207429C0.538757 -0.069204 1.03813 -0.0691016 1.3461
    0.207429L6.35 4.70743L1.34609 9.20645C1.03812 9.48338 0.538877 9.48332 0.23086 9.20645C-0.0768551 8.92948 -0.0770513 8.48039 0.23086
    8.20352L4.11953 4.70743L0.230861 1.21036Z" fill="#595959" />
  </svg>
);

export const EntryPathsExpandIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={entryPathsExpandSVG} {...props} ref={ref} />
));
// 上级目录
const forwardIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="9" viewBox="0 0 13 9" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M1.18951 7.80957C0.917289 8.12177 0.476372 8.12177 0.204154 7.80957C-0.0679492
    7.49736 -0.0680255 6.99185 0.204154 6.67969L6.0274 1.38043e-06L11.8506 6.67969C12.1228 6.99182 12.1227 7.49737 11.8506 7.80957C11.5784
    8.12177 11.1375 8.12177 10.8653 7.80957L6.0274 2.26172L1.18951 7.80957Z" fill="currentColor" />
  </svg>
);

export const ForwardIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled
      ? <DisableIconContainer><CustomIcon component={forwardIconSVG} {...props} ref={ref} /></DisableIconContainer>
      : <IconContainer><CustomIcon component={forwardIconSVG} {...props} ref={ref} /></IconContainer>
  ),
);

// 刷新
const freshIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="22" viewBox="0 0 24 22" fill="none">
    <g clipPath="url(#clip0_6299_787)">
      <rect width="24" height="22" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H18C21.3137 0 24 2.68629 24 6V16C24 19.3137 21.3137 22 18 22H6C2.68629 22 0 19.3137 0 16V6Z"
        fill="none" />
      <path fillRule="evenodd" clipRule="evenodd" d="M8.46936 4.21204C10.0398 3.37262 11.8537 3.103 13.6002 3.45032C15.3467
      3.79776 16.9188 4.74082 18.0485 6.11731C18.659 6.86135 19.118 7.70794 19.4127 8.6095L19.6217 7.77845C19.7224 7.3769 20.1292
      7.13213 20.5309 7.23255C20.9323 7.33305 21.1767 7.74023 21.0768 8.14173L20.4039 10.8312C20.1783 11.7322 19.0839 12.081 18.3785
      11.4767L15.9528 9.39759C15.6386 9.12797 15.6022 8.65435 15.8717 8.33997C16.1414 8.02616 16.6151 7.98961 16.9293 8.25891L18.0289
      9.2013C17.7945 8.42793 17.4094 7.70224 16.8893 7.06848C15.9797 5.96021 14.7134 5.20171 13.3072 4.922C11.9013 4.64244 10.4416 4.8587
      9.17736 5.5343C7.91306 6.2102 6.92131 7.30452 6.37268 8.62903C5.82429 9.95341 5.75155 11.4272 6.1676 12.799C6.58378 14.1709 7.4629
      15.3569 8.6549 16.1534C9.84691 16.9499 11.279 17.3085 12.7057 17.1681C14.1324 17.0276 15.4663 16.3956 16.4801 15.382C16.7728 15.0892
      17.2477 15.0896 17.5406 15.382C17.8335 15.6749 17.8335 16.1496 17.5406 16.4425C16.2815 17.7015 14.6251 18.4857 12.8531 18.6603C11.0811
      18.8347 9.30245 18.3898 7.8219 17.4005C6.34131 16.4112 5.24898 14.9385 4.73205 13.2345C4.21522 11.5306 4.30566 9.69988 4.98693
      8.05481C5.6683 6.40985 6.89922 5.05154 8.46936 4.21204Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6299_787">
        <rect width="24" height="22" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const FreshIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={freshIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <FreshIconContainer><CustomIcon component={freshIconSVG} {...props} ref={ref} /></FreshIconContainer>
    )
  ),
);

// shell中打开
const openInShellIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 18 16" fill="none">
    <path d="M18 12.001C18 14.2101 16.2091 16.001 14 16.001H4C1.79086 16.001 0 14.2101
    0 12.001V6H18V12.001ZM4.37207 8.44434C4.11227 8.23897 3.73489 8.28328 3.5293
    8.54297C3.32404 8.80276 3.36828 9.18018 3.62793 9.38574L5.43262 10.8145L3.62793
    12.2441C3.3682 12.4498 3.32364 12.8281 3.5293 13.0879C3.73493 13.3474 4.11235 13.3909
    4.37207 13.1855L6.77246 11.2852C6.91595 11.1715 6.99982 10.9985 7 10.8154C7 10.6322
    6.91611 10.4585 6.77246 10.3447L4.37207 8.44434ZM8 11.5156C7.66863 11.5156 7.40039
    11.7839 7.40039 12.1152C7.40045 12.4466 7.66867 12.7148 8 12.7148H11.5996C11.9309
    12.7148 12.2001 12.4466 12.2002 12.1152C12.2002 11.7839 11.931 11.5156 11.5996
    11.5156H8ZM14 0C16.2091 0 18 1.79086 18 4V5H0V4C0 1.79086 1.79086 1.61064e-08 4
    0H14ZM2.85742 2.85742C2.54183 2.85742 2.28613 3.11312 2.28613 3.42871C2.28619
    3.74425 2.54187 4 2.85742 4C3.17285 3.99984 3.42865 3.74416 3.42871 3.42871C3.42871
    3.11322 3.17288 2.85758 2.85742 2.85742ZM5.14258 2.85742C4.82712 2.85758 4.57129 3.11322
    4.57129 3.42871C4.57135 3.74416 4.82716 3.99984 5.14258 4C5.45813 4 5.71381 3.74425 5.71387
    3.42871C5.71387 3.11312 5.45817 2.85742 5.14258 2.85742ZM7.42871 2.85742C7.11312 2.85742
    6.85742 3.11312 6.85742 3.42871C6.85748 3.74425 7.11315 4 7.42871 4C7.74421 3.99993
    7.99994 3.74421 8 3.42871C8 3.11316 7.74424 2.85749 7.42871 2.85742Z" fill="currentColor" />
  </svg>
);

export const OpenInShellIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled
      ? <DisableIconContainer><CustomIcon component={openInShellIconSVG} {...props} ref={ref} /></DisableIconContainer>
      : <IconContainer><CustomIcon component={openInShellIconSVG} {...props} ref={ref} /></IconContainer>
  ),
);

// 新建图标
const createIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6332_24011)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137
      18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M12 2C14.2091 2 16 3.79086 16 6V12C16 14.14 14.3194 15.8879 12.2061 15.9951L12 16H6L5.79395
      15.9951C3.7488 15.8913 2.10865 14.2512 2.00488 12.2061L2 12V6C2 3.79086 3.79086 2 6 2H12ZM6 3.2002C4.4536
      3.2002 3.2002 4.4536 3.2002 6V12C3.2002 13.5464 4.4536 14.7998 6 14.7998H12C13.5464 14.7998 14.7998 13.5464
      14.7998 12V6C14.7998 4.4536 13.5464 3.2002 12 3.2002H6ZM8.99902 5.20312C9.27494 5.20487 9.50035 5.43011 9.50195
      5.70605L9.5166 8.53418L12.3467 8.55078C12.6226 8.55251 12.848 8.77777 12.8496 9.05371C12.851 9.32949 12.6283
      9.55196 12.3525 9.55078L9.52246 9.53418L9.53809 12.3516C9.53937 12.6274 9.31694 12.8501 9.04102 12.8486C8.76509
      12.847 8.53978 12.6216 8.53809 12.3457L8.52246 9.5293L5.70703 9.51367C5.43111 9.51214 5.20599 9.28756 5.2041
      9.01172C5.20257 8.73558 5.42503 8.51214 5.70117 8.51367L8.5166 8.5293L8.50195 5.7002C8.50061 5.42422 8.723
      5.20159 8.99902 5.20312Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_24011">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>

);

export const CreateIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={createIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={createIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);

// 上传
const uploadIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M12 2C14.2091 2 16 3.79086 16 6V12C16 14.14 14.3194 15.8879 12.2061 15.9951L12 16H6L5.79395 15.9951C3.7488
    15.8913 2.10865 14.2512 2.00488 12.2061L2 12V6C2 3.79086 3.79086 2 6 2H12ZM6 3.2002C4.4536 3.2002 3.2002 4.4536
    3.2002 6V12C3.2002 13.5464 4.4536 14.7998 6 14.7998H12C13.5464 14.7998 14.7998 13.5464 14.7998 12V6C14.7998 4.4536
    13.5464 3.2002 12 3.2002H6ZM12.3799 8.82715C12.6558 8.82715 12.8795 9.05129 12.8799 9.32715V11.6201C12.8798 12.4485
    12.2083 13.1201 11.3799 13.1201H6.70898C5.88075 13.1199 5.20905 12.4484 5.20898 11.6201V9.32715C5.20932 9.0514 5.4332
    8.82733 5.70898 8.82715C5.98492 8.82715 6.20865 9.05129 6.20898 9.32715V11.6201C6.20905 11.8961 6.43303 12.1199 6.70898
    12.1201H11.3799C11.656 12.1201 11.8798 11.8962 11.8799 11.6201V9.32715C11.8802 9.05144 12.1042 8.82739 12.3799 8.82715ZM8.63867
    5.30566C8.90875 5.12951 9.2743 5.15951 9.5127 5.39453L11.3496 7.20703C11.5457 7.40097 11.5471 7.71765 11.3535 7.91406C11.1596
    8.11042 10.843 8.11256 10.6465 7.91895L9.5166 6.80273V10.3965C9.5164 10.6723 9.29245 10.8963 9.0166 10.8965C8.74064 10.8964
    8.51681 10.6724 8.5166 10.3965V6.81152L7.39551 7.91895C7.19912 8.11282 6.88251 8.11019 6.68848 7.91406C6.49483 7.71753 6.496
    7.40092 6.69238 7.20703L8.5293 5.39453L8.63867 5.30566Z" fill="currentColor" />
  </svg>
);

export const UploadIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={uploadIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={uploadIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);

// 复制
const copyIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6332_24021)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M13.4922 3C14.928 3.00005 16.0916 4.16386 16.0918 5.59961V10.5947C16.0918 12.0306 14.9281 13.1943 13.4922
      13.1943H12.7363V13.9512L12.7256 14.1553C12.6299 15.0964 11.8816 15.8449 10.9404 15.9404L10.7363 15.9512H4L3.7959 15.9404C2.85458
      15.845 2.1065 15.0965 2.01074 14.1553L2 13.9512V7.21484C2.0001 6.1793 2.78731 5.32786 3.7959 5.22559L4 5.21484H5.92969C6.11592
      3.96197 7.19235 3.0002 8.49707 3H13.4922ZM4 6.41504C3.55824 6.41504 3.2003 6.77311 3.2002 7.21484V13.9512C3.20058 14.3927
      3.55841 14.751 4 14.751H10.7363C11.1778 14.7508 11.5358 14.3926 11.5361 13.9512V7.21484C11.536 6.7732 11.178 6.41519 10.7363
      6.41504H4ZM8.49707 4.19922C7.85776 4.19941 7.31981 4.62915 7.15234 5.21484H10.7363L10.9404 5.22559C11.9489 5.32799 12.7362
      6.17939 12.7363 7.21484V11.9951H13.4922C14.2653 11.9951 14.8925 11.3679 14.8926 10.5947V5.59961C14.8924 4.8266 14.2652 4.19927
      13.4922 4.19922H8.49707Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_24021">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const CopyIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={copyIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={copyIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);

// 移动
const moveIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6332_24026)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path fillRule="evenodd" clipRule="evenodd" d="M8.32629 2.24609C8.72935 1.91734 9.31173 1.91766 9.71496 2.24609L9.79894
      2.32227L11.339 3.86231C11.5731 4.09663 11.5732 4.47669 11.339 4.71094C11.1047 4.94509 10.7247 4.945 10.4904 4.71094L9.62121
      3.84082V8.42188H14.2032L13.3312 7.55078C13.0974 7.31657 13.0974 6.93734 13.3312 6.70313C13.5655 6.46914 13.9456 6.46892
      14.1798 6.70313L15.7198 8.24316L15.796 8.32617C16.1248 8.72923 16.1245 9.31161 15.796 9.71484L15.7198 9.79883L14.1798
      11.3389C13.9455 11.573 13.5654 11.5731 13.3312 11.3389C13.097 11.1046 13.0971 10.7245 13.3312 10.4902L14.2013
      9.62109H9.62121V14.2012L10.4913 13.3311C10.7255 13.0973 11.1048 13.0973 11.339 13.3311C11.573 13.5654 11.5732 13.9455
      11.339 14.1797L9.79894 15.7197L9.71594 15.7959C9.31287 16.1247 8.7305 16.1244 8.32726 15.7959L8.24328 15.7197L6.70324
      14.1797C6.46915 13.9454 6.46901 13.5653 6.70324 13.3311C6.93749 13.0969 7.31757 13.097 7.55187 13.3311L8.42199
      14.2012V9.62109H3.83996L4.71105 10.4912C4.94484 10.7254 4.94484 11.1047 4.71105 11.3389C4.47671 11.5729 4.09663
      11.5731 3.86242 11.3389L2.32238 9.79883L2.24621 9.71582C1.91745 9.31275 1.91776 8.73038 2.24621 8.32715L2.32238
      8.24316L3.86242 6.70313C4.09674 6.46904 4.47681 6.46892 4.71105 6.70313C4.94521 6.93737 4.94512 7.31746 4.71105
      7.55176L3.83996 8.42188H8.42199V3.83887L7.5509 4.71094C7.31668 4.94472 6.93745 4.94472 6.70324 4.71094C6.46927
      4.4766 6.46904 4.09651 6.70324 3.86231L8.24328 2.32227L8.32629 2.24609Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_24026">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const MoveIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={moveIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={moveIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);

// 粘贴
const pasteIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6332_24031)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path fillRule="evenodd" clipRule="evenodd" d="M5.04102 3.64258C5.14679 3.3875 5.44023 3.26629 5.69531 3.37207C5.94983
      3.47813 6.07049 3.77059 5.96484 4.02539C5.89187 4.20148 5.85156 4.39542 5.85156 4.59961V4.69336H10.8916L11.0957
      4.7041C12.1042 4.80641 12.8914 5.65791 12.8916 6.69336V12.1533H13.0205C13.0647 12.1534 13.1076 12.1601 13.1484
      12.1709C13.1894 12.16 13.2329 12.1533 13.2773 12.1533H13.4053C13.6094 12.1533 13.8034 12.113 13.9795
      12.04C14.2344 11.9344 14.527 12.0547 14.6328 12.3096C14.7382 12.5644 14.617 12.8571 14.3623 12.9629C14.067 13.0854
      13.7432 13.1533 13.4053 13.1533H13.2773C13.2329 13.1533 13.1894 13.1456 13.1484 13.1348C13.1076 13.1456 13.0648
      13.1533 13.0205 13.1533H12.8916V13.585L12.8809 13.7891C12.7854 14.7305 12.0371 15.4787 11.0957 15.5742L10.8916 15.585H4L3.7959
      15.5742C2.8544 15.4788 2.10625 14.7305 2.01074 13.7891L2 13.585V6.69336C2.00019 5.58895 2.89555 4.69336 4
      4.69336H4.85156V4.59961C4.85156 4.26175 4.91863 3.9379 5.04102 3.64258ZM4 5.89355C3.55829 5.89355 3.20039 6.2517 3.2002
      6.69336V13.585C3.20027 14.0267 3.55822 14.3848 4 14.3848H10.8916C11.3333 14.3847 11.6913 14.0267 11.6914 13.585V6.69336C11.6912
      6.25174 11.3332 5.89362 10.8916 5.89355H4ZM15.4053 9.39648C15.6812 9.39669 15.9052 9.6205 15.9053 9.89648V10.6533C15.9052 10.9912
      15.8373 11.315 15.7148 11.6104C15.609 11.865 15.3163 11.9862 15.0615 11.8809C14.8068 11.775 14.6865 11.4824 14.792 11.2275C14.865
      11.0515 14.9052 10.8574 14.9053 10.6533V9.89648C14.9053 9.62038 15.1292 9.39648 15.4053 9.39648ZM15.4053 6.37012C15.6812 6.37032
      15.9053 6.5941 15.9053 6.87012V8.38281C15.905 8.65861 15.6811 8.88261 15.4053 8.88281C15.1293 8.88281 14.9055 8.65873 14.9053
      8.38281V6.87012C14.9053 6.59398 15.1291 6.37012 15.4053 6.37012ZM15.0615 3.37207C15.3165 3.26639 15.609 3.38761 15.7148
      3.64258C15.8372 3.9379 15.9053 4.26175 15.9053 4.59961V5.35645C15.9049 5.63218 15.681 5.85624 15.4053 5.85645C15.1293 5.85645
      14.9056 5.63231 14.9053 5.35645V4.59961C14.9053 4.3955 14.8649 4.20142 14.792 4.02539C14.6863 3.77042 14.8067 3.47796 15.0615
      3.37207ZM8.1084 2.09961C8.38433 2.09986 8.6084 2.32362 8.6084 2.59961C8.60814 2.87538 8.38417 3.09936 8.1084 3.09961H7.35156C7.1473
      3.09961 6.95348 3.13987 6.77734 3.21289C6.52257 3.31853 6.23011 3.19782 6.12402 2.94336C6.01825 2.68828 6.13945 2.39484 6.39453
      2.28906C6.68991 2.16662 7.01363 2.09961 7.35156 2.09961H8.1084ZM13.4053 2.09961C13.7431 2.09966 14.067 2.16663 14.3623 2.28906C14.6171
      2.395 14.7385 2.68843 14.6328 2.94336C14.5269 3.19783 14.2342 3.3182 13.9795 3.21289C13.8034 3.13988 13.6094 3.09966 13.4053
      3.09961H12.6484C12.3725 3.09957 12.1487 2.8755 12.1484 2.59961C12.1484 2.32349 12.3723 2.09965 12.6484 2.09961H13.4053ZM11.1348
      2.09961C11.4108 2.09979 11.6348 2.32358 11.6348 2.59961C11.6345 2.87542 11.4106 3.09943 11.1348 3.09961H9.62207C9.34609 3.09961
      9.12233 2.87553 9.12207 2.59961C9.12207 2.32347 9.34593 2.09961 9.62207 2.09961H11.1348Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_24031">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const PasteIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={pasteIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={pasteIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);
// 压缩
const compressIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6332_24036)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M6.60254 10.1055C7.21005 10.1055 7.70312 10.5985 7.70312 11.2061V15.209C7.70295 15.5402 7.4338 15.8086 7.10254 15.8086C6.77152
      15.8083 6.5031 15.54 6.50293 15.209V11.3057H2.59961C2.26856 11.3055 2.00029 11.0371 2 10.7061C2 10.3748 2.26838 10.1056 2.59961
      10.1055H6.60254ZM15.209 10.1055C15.5402 10.1056 15.8086 10.3748 15.8086 10.7061C15.8083 11.0371 15.54 11.3055 15.209
      11.3057H11.3057V15.209C11.3055 15.54 11.0371 15.8083 10.7061 15.8086C10.3748 15.8086 10.1056 15.5402 10.1055 15.209V11.2061C10.1055
      10.5985 10.5985 10.1055 11.2061 10.1055H15.209ZM7.10254 2C7.4338 2 7.70295 2.26838 7.70312 2.59961V6.60254C7.70312 7.21005 7.21005
      7.70312 6.60254 7.70312H2.59961C2.26838 7.70295 2 7.4338 2 7.10254C2.00029 6.77152 2.26856 6.5031 2.59961 6.50293H6.50293V2.59961C6.5031
      2.26856 6.77152 2.00029 7.10254 2ZM10.7061 2C11.0371 2.00029 11.3055 2.26856 11.3057 2.59961V6.50293H15.209C15.54 6.5031 15.8083 6.77152
      15.8086 7.10254C15.8086 7.4338 15.5402 7.70295 15.209 7.70312H11.2061C10.5985 7.70312 10.1055 7.21005 10.1055 6.60254V2.59961C10.1056
      2.26838 10.3748 2 10.7061 2Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_24036">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const CompressIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={compressIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={compressIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);
// 解压缩
const decompressIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect width="18" height="18" rx="4" fill="none" />
    <path d="M3.59961 10.7432C3.93095 10.7432 4.19917 11.0124 4.19922 11.3438V13.7969H6.55176C6.8829 13.7971 7.15132 14.0653 7.15137
    14.3965C7.15137 14.7277 6.88292 14.9959 6.55176 14.9961H4.09961C3.49214 14.996 3 14.504 3 13.8965V11.3438C3.00004 11.0125
    3.26831 10.7432 3.59961 10.7432ZM14.3965 10.7432C14.7278 10.7432 14.996 11.0125 14.9961 11.3438V13.8965C14.9961 14.504 14.504
    14.996 13.8965 14.9961H11.3438C11.0124 14.9961 10.7432 14.7279 10.7432 14.3965C10.7432 14.0652 11.0124 13.7969 11.3438
    13.7969H13.7969V11.3438C13.7969 11.0124 14.0651 10.7432 14.3965 10.7432ZM6.65234 3C6.98371 3 7.25293 3.26824 7.25293 3.59961C7.25289
    3.93094 6.98369 4.19922 6.65234 4.19922H4.19922V6.65234C4.19917 6.98368 3.93095 7.25293 3.59961 7.25293C3.26831 7.25287 3.00004 6.98364
    3 6.65234V4.09961C3 3.49213 3.49214 3.00006 4.09961 3H6.65234ZM13.8965 3C14.504 3.00006 14.9961 3.49213 14.9961 4.09961V6.65234C14.996
    6.98364 14.7278 7.25287 14.3965 7.25293C14.0651 7.25293 13.7969 6.98368 13.7969 6.65234V4.19922H11.3438C11.0124 4.19922 10.7432 3.93094
    10.7432 3.59961C10.7432 3.26824 11.0124 3 11.3438 3H13.8965Z" fill="currentColor" />
  </svg>
);

export const DecompressIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={decompressIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={decompressIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);
// 下载
const downloadIconSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_6332_23957)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M14.3193 8.89062C14.6505 8.89078 14.9189 9.15902 14.9189 9.49023V13.7812C14.9189 14.6648 14.2029 15.3807 13.3193
      15.3809H4.59961C3.71595 15.3809 3 14.6649 3 13.7812V9.49023C3.00006 9.15892 3.26828 8.89062 3.59961 8.89062C3.93093 8.89064
      4.19915 9.15893 4.19922 9.49023V13.7812C4.19922 14.0022 4.3787 14.1816 4.59961 14.1816H13.3193C13.5401 14.1815 13.7188 14.0021
      13.7188 13.7812V9.49023C13.7188 9.15892 13.988 8.89062 14.3193 8.89062ZM8.92773 3C9.25886 3.00028 9.52734 3.26841 9.52734
      3.59961V9.8457L11.6758 7.72461C11.9115 7.49196 12.2916 7.49493 12.5244 7.73047C12.7568 7.96628 12.7551 8.34641 12.5195
      8.5791L9.48242 11.5762L9.42188 11.6309C9.12999 11.8659 8.71081 11.8659 8.41895 11.6309L8.3584 11.5762L5.32227 8.5791C5.08675
      8.34638 5.08396 7.96624 5.31641 7.73047C5.54904 7.49487 5.9292 7.49233 6.16504 7.72461L8.32812 9.85938V3.59961C8.32812 3.26824
      8.59636 3 8.92773 3Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_23957">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const DownloadIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={downloadIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={downloadIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);
// 删除
const deleteIconSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_6332_23958)">
      <rect width="18" height="18" rx="4" fill="none" />
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M15.2939 5.65625C15.6253 5.65629 15.8945 5.92451 15.8945 6.25586C15.8943 6.58699 15.6251 6.85543 15.2939 6.85547H13.8262V13.29C13.826
      14.7257 12.6623 15.8895 11.2266 15.8896H6.72461C5.28882 15.8896 4.12514 14.7258 4.125 13.29V6.85547H2.59961C2.26839 6.85547 2.00025
      6.58702 2 6.25586C2 5.92449 2.26824 5.65625 2.59961 5.65625H15.2939ZM5.32422 6.85547V13.29C5.32436 14.0631 5.95156 14.6894 6.72461
      14.6895H11.2266C11.9995 14.6893 12.6258 14.063 12.626 13.29V6.85547H5.32422ZM7.61035 8.81445C7.88649 8.81445 8.11035 9.03831 8.11035
      9.31445V12.6123C8.11001 12.8882 7.88628 13.1123 7.61035 13.1123C7.33467 13.112 7.11069 12.888 7.11035 12.6123V9.31445C7.11035 9.03849
      7.33445 8.81474 7.61035 8.81445ZM10.2832 8.81445C10.5593 8.81445 10.7832 9.03831 10.7832 9.31445V12.6123C10.7829 12.8882 10.5591 13.1123
      10.2832 13.1123C10.0074 13.1122 9.78355 12.8881 9.7832 12.6123V9.31445C9.7832 9.03839 10.0072 8.81458 10.2832 8.81445ZM12.2881 3C12.6192
      3.00024 12.8876 3.2685 12.8877 3.59961C12.8876 3.93076 12.6192 4.19897 12.2881 4.19922H5.60645C5.27512 4.19922 5.00692 3.93091 5.00684
      3.59961C5.00697 3.26835 5.27516 3 5.60645 3H12.2881Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6332_23958">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>

);

export const DeleteIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled ? (
      <DisableIconContainer><CustomIcon component={deleteIconSVG} {...props} ref={ref} /></DisableIconContainer>
    ) : (
      <IconContainer><CustomIcon component={deleteIconSVG} {...props} ref={ref} /></IconContainer>
    )
  ),
);
// 家目录
const homeDirIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6299_861)">
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path fillRule="evenodd" clipRule="evenodd" d="M13.8733 9.07907C14.2047 9.07907 14.4739 9.34731 14.4739 9.67868V14.3154C14.4738
      15.199 13.7569 15.916 12.8733 15.916H5.47875C4.59518 15.916 3.87926 15.1989 3.87915 14.3154V9.67868C3.87915 9.34731 4.14739 9.07908
      4.47875 9.07907C4.81013 9.07907 5.07836 9.34731 5.07836 9.67868V14.3154C5.07848 14.5362 5.25792 14.7158 5.47875
      14.7158H6.6975V12.5576C6.6975 11.674 7.41354 10.9581 8.29711 10.958H10.0549C10.9386 10.958 11.6555 11.6739 11.6555
      12.5576V14.7158H12.8733C13.0941 14.7158 13.2736 14.5362 13.2737 14.3154V9.67868C13.2737 9.3474 13.542 9.07923 13.8733
      9.07907ZM8.29711 12.1572C8.07628 12.1573 7.89672 12.3367 7.89672 12.5576V14.7158H10.4553V12.5576C10.4553 12.3367 10.2758
      12.1572 10.0549 12.1572H8.29711ZM8.4309 3.31833C9.0151 2.88193 9.82101 2.8954 10.3899 3.35153L16.1282 7.95602C16.3863 8.16328
      16.4277 8.54042 16.2209 8.7988C16.0136 9.05725 15.6356 9.09895 15.3772 8.89157L9.63891 4.28805C9.49672 4.17408 9.29568 4.17024
      9.14965 4.27926L2.95922 8.90426C2.69386 9.10253 2.31777 9.04838 2.11938 8.78317C1.92122 8.51781 1.9753 8.14169 2.24047 7.94333L8.4309
      3.31833Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6299_861">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const HomeDirIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled
      ? <DisableIconContainer><CustomIcon component={homeDirIconSVG} {...props} ref={ref} /></DisableIconContainer>
      : <IconContainer><CustomIcon component={homeDirIconSVG} {...props} ref={ref} /></IconContainer>
  ),
);
// 快捷路径
const entryPathIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6371_11415)">
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M6.11914 4C6.45206 4.00014 6.77566 4.10382 7.04492 4.29492L7.15723 4.38184V4.38281L7.97168 5.07715H13.5254C14.9613 5.07715
      16.125 6.24082 16.125 7.67676V12.2939C16.125 13.7299 14.9613 14.8936 13.5254 14.8936H4.59961C3.16383 14.8934 2.00002 13.7298 2
      12.2939V5.59961C2 4.71604 2.71608 4.00014 3.59961 4H6.11914ZM3.59961 5.19922C3.37882 5.19936 3.19922 5.37878 3.19922
      5.59961V12.2939C3.19924 13.067 3.82655 13.6942 4.59961 13.6943H13.5254C14.2986 13.6943 14.9258 13.0671 14.9258 12.2939V7.67676C14.9258
      6.90356 14.2986 6.27637 13.5254 6.27637H7.5293L7.36035 6.13281L6.37793 5.29492C6.32369 5.24885 6.25837 5.21849 6.18945 5.20605L6.11914
      5.19922H3.59961ZM9.63965 11.0625C9.91574 11.0625 10.1396 11.2864 10.1396 11.5625C10.1396 11.8386 9.91579 12.0625 9.63965
      12.0625H5.25391C4.97798 12.0622 4.75391 11.8385 4.75391 11.5625C4.75399 11.2866 4.97803 11.0628 5.25391 11.0625H9.63965Z"
        fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6371_11415">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const EntryPathIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled
      ? <DisableIconContainer><CustomIcon component={entryPathIconSVG} {...props} ref={ref} /></DisableIconContainer>
      : <IconContainer><CustomIcon component={entryPathIconSVG} {...props} ref={ref} /></IconContainer>
  ),
);
// 存储系统
const storageIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_6654_2775)">
      <path d="M0 6C0 2.68629 2.68629 0 6 0H12C15.3137 0 18 2.68629 18 6V12C18 15.3137 15.3137 18 12 18H6C2.68629 18 0 15.3137 0 12V6Z" fill="none" />
      <path d="M13.2041 3.01074C14.2128 3.113 15 3.96435 15 5V13L14.9893 13.2041C14.8938 14.1457 14.1457 14.8938 13.2041 14.9893L13
      15H5C3.96435 15 3.113 14.2128 3.01074 13.2041L3 13V5C3 3.89543 3.89543 3 5 3H13L13.2041 3.01074ZM5 4.2002C4.55817 4.2002 4.2002
      4.55817 4.2002 5V13C4.2002 13.4418 4.55817 13.7998 5 13.7998H13C13.4418 13.7998 13.7998 13.4418 13.7998 13V5C13.7998 4.55817
      13.4418 4.2002 13 4.2002H12.0625C12.1698 4.44532 12.2314 4.71529 12.2314 5V7.46191L12.2207 7.66602C12.1251 8.6072 11.3767
      9.35546 10.4355 9.45117L10.2314 9.46191H7.76953L7.56543 9.45117C6.62399 9.35574 5.8759 8.60739 5.78027 7.66602L5.76953
      7.46191V5C5.76953 4.71533 5.8303 4.44528 5.9375 4.2002H5ZM7.76953 4.2002C7.32771 4.2002 6.96973 4.55817 6.96973 5V7.46191C6.96993
      7.90357 7.32783 8.26172 7.76953 8.26172H10.2314C10.6728 8.26135 11.031 7.90335 11.0312 7.46191V5C11.0312 4.58576 10.716 4.24501
      10.3125 4.2041L10.2314 4.2002H7.76953Z" fill="currentColor" />
    </g>
    <defs>
      <clipPath id="clip0_6654_2775">
        <rect width="18" height="18" rx="4" fill="none" />
      </clipPath>
    </defs>
  </svg>
);

export const StorageIcon: React.ForwardRefExoticComponent<IconProps> = React.forwardRef(
  ({ disabled, onClick, style, ...props }, ref: Ref<HTMLSpanElement> | undefined) => (
    disabled
      ? (
        <DisableIconContainer style={{ cursor: "default", ...style }}>
          <CustomIcon component={storageIconSVG} {...props} ref={ref} />
        </DisableIconContainer>
      ) : (
        <IconContainer style={{ cursor: "default", ...style }}>
          <CustomIcon component={storageIconSVG} {...props} ref={ref} />
        </IconContainer>
      )
  ),
);
