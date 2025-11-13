import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";

// 定义图标组件的接口以接受样式属性

// 文件夹的SVG
const folderSVG = () => (
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
      fill="url(#paint0_linear_18_925)"
    />
    <defs>
      <linearGradient id="paint0_linear_18_925" x1="16" y1="12" x2="16" y2="22" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFE600" />
        <stop offset="1" stop-color="#FFBF00" />
      </linearGradient>
    </defs>
  </svg>

);

export const FolderIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={folderSVG} {...props} ref={ref} />
));

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
        <stop stop-color="#34B1FF" />
        <stop offset="1" stop-color="#3470FF" />
      </linearGradient>
    </defs>
  </svg>

);

export const ArchiveIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={archiveSVG} {...props} ref={ref} />
));

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
        <stop stop-color="#34B1FF" />
        <stop offset="1" stop-color="#3470FF" />
      </linearGradient>
    </defs>
  </svg>

);

export const SymlinkIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={symlinkSVG} {...props} ref={ref} />
));

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
        <stop stop-color="#34B1FF" />
        <stop offset="1" stop-color="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const SupportedFileIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={supportedFileSVG} {...props} ref={ref} />
));

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
        <stop stop-color="#34B1FF" />
        <stop offset="1" stop-color="#3470FF" />
      </linearGradient>
    </defs>
  </svg>
);

export const ImageIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={imageSVG} {...props} ref={ref} />
));

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
        <stop stop-color="#E4E4E4" />
        <stop offset="1" stop-color="#A5A5A5" />
      </linearGradient>
    </defs>
  </svg>


);

export const UnrecognizedFileIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={unrecognizedFileSVG} {...props} ref={ref} />
));
