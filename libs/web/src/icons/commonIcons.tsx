/* eslint-disable @stylistic/max-len */

import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";

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
    return (
      <Icon
        component={Svg}
        ref={ref}
        {...rest}
        style={{ transform: `scale(${defaultScale})`, ...style }}
      />
    );
  });
}

// 问号
const questionMarkSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#888FA3" fillOpacity="0.15" />
    <path d="M8.81628 11.7637H7.64636V10.583H8.81628V11.7637ZM8.28699 4.15332C8.71353 4.15336 9.08 4.23359 9.3866 4.39355C9.69993 4.55355 9.93656 4.77371 10.0966 5.05371C10.2631 5.32695 10.3465 5.63999 10.3466 5.99316C10.3466 6.25983 10.3033 6.49336 10.2167 6.69336C10.13 6.88668 10.023 7.05027 9.89636 7.18359C9.77639 7.31685 9.61671 7.46725 9.41687 7.63379C9.18377 7.8336 9.00346 8.01297 8.87683 8.17285C8.75686 8.32615 8.68999 8.51657 8.67664 8.74316L8.64636 9.45312H7.80652L7.77625 8.81348C7.76292 8.56021 7.79687 8.33685 7.87683 8.14355C7.95682 7.94358 8.05355 7.77688 8.16687 7.64355C8.28687 7.50355 8.44326 7.34618 8.6366 7.17285C8.87648 6.95294 9.05356 6.76347 9.16687 6.60352C9.28685 6.43688 9.34654 6.24339 9.34656 6.02344C9.34656 5.75015 9.24978 5.52373 9.05652 5.34375C8.86323 5.15713 8.5935 5.06352 8.24695 5.06348C7.91372 5.06348 7.62345 5.15312 7.37683 5.33301C7.13689 5.5063 6.92382 5.76673 6.73718 6.11328L6.00671 5.58301C6.21334 5.13654 6.50986 4.78648 6.89636 4.5332C7.28303 4.27987 7.74699 4.15332 8.28699 4.15332Z" fill="#888FA3" />
  </svg>
);


export const QuestionMarkIcon = createIcon(questionMarkSVG);
