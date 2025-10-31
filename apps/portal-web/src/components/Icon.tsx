import React, { ComponentType, CSSProperties, ReactElement } from "react";
import { AllJobsIcon, LoginClusterIcon, RunningJobsIcon,
  ShellIcon, SubmitJobIcon, TemplateJobIcon } from "src/icons/headerIcons/headerIcons";

const iconMap = {
  PlusCircleOutlined: <SubmitJobIcon styles={{ transform: "scale(3.4)" }} />,
  BookOutlined: <RunningJobsIcon styles={{ transform: "scale(3.4)" }} />,
  SaveOutlined: <TemplateJobIcon styles={{ transform: "scale(3.4)" }} />,
  LoginClusterOutlined: <LoginClusterIcon styles={{ transform: "scale(3.4)" }} />,
  MacCommandOutlined: <ShellIcon styles={{ transform: "scale(3.4)" }} />,
  AllJobsOutlined:<AllJobsIcon styles={{ transform: "scale(3.4)" }} />,
};

export type IconName = keyof typeof iconMap;
interface IconProps {
  name: IconName;
  style: CSSProperties;
}

export const Icon = (props: IconProps) => {
  const { name } = props;

  // 确保图标组件接收并应用 style 属性
  return React.cloneElement(iconMap[name], { style:props.style });
};


export function isSupportedIconName(iconName: string): iconName is IconName {
  return iconName in iconMap;
}

interface WithColorProps {
  color?: string;
  style?: CSSProperties;
}

const withColor = <P extends IconProps>(
  WrappedComponent: ComponentType<P & WithColorProps>,
): ComponentType<P & WithColorProps> => {
  return (props: P & WithColorProps): ReactElement => {
    const { color, style, ...restProps } = props;

    const modifiedStyle: CSSProperties = {
      color: color,
      ...style,
    };

    return <WrappedComponent {...restProps as P} style={modifiedStyle} />;
  };
};

export const ColoredIcon = withColor(Icon);



