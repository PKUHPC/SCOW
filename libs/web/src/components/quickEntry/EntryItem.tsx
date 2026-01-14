import { PictureOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { join } from "path";
import React, { ComponentType, CSSProperties, ReactElement, useState } from "react";
import { styled, useTheme } from "styled-components";

const ItemContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: center;
  height: 100%;
  width: 100%;
  position: relative;
`;

const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
  flex: 1;
  align-items: center;
`;

interface IconProps {
  name: string;
  style: CSSProperties;
}

interface WithColorProps {
  color?: string;
  style?: CSSProperties;
}

interface Props {
  entryBaseName: string;
  publicPath: string;
  iconMap: Record<string, React.ReactElement>;
  entryExtraInfo?: string[];
  icon?: string,
  logoPath?: string;
  style?: CSSProperties
}

type ImageErrorMap = Record<string, boolean>;

export const EntryItem: React.FC<Props> = ({ style, iconMap,
  entryBaseName, entryExtraInfo, icon, logoPath, publicPath }) => {

  const [imageErrorMap, setImageErrorMap] = useState<ImageErrorMap>({});
  const theme = useTheme();
  const { Text } = Typography;

  const handleImageError = (appId: string) => {
    setImageErrorMap((prevMap) => ({ ...prevMap, [appId]: true }));
  };

  const isSupportedIconName = (iconName: string): boolean => {
    return iconName in iconMap;
  };

  const Icon = (props: IconProps) => {
    const { name } = props;

    // 确保图标组件接收并应用 style 属性
    return React.cloneElement(iconMap[name], { style:props.style });
  };

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

  const ColoredIcon = withColor(Icon);

  return (
    <ItemContainer style={style}>
      <AvatarContainer>
        {
          (logoPath && imageErrorMap[entryBaseName] !== true) ? (
            <img
              src={join(publicPath, logoPath)}
              onError={() => handleImageError(entryBaseName)}
              style={{ maxWidth:"70px", objectFit:"contain",
                position:"relative", top:`${(entryExtraInfo?.length ?? 0 - 0) * 8}px` }}
            />
          ) : (
            icon && isSupportedIconName(icon) ? (
              <ColoredIcon
                name={icon}
                style={{ fontSize:`${60 - (entryExtraInfo?.length ?? 0 - 0) * 4}px`,
                  color:theme.token.colorPrimary,
                  position:"relative", top:`${(entryExtraInfo?.length ?? 0 - 0) * 8}px`,
                  transform: "scale(3.4)",
                }}
              />
            )
              : <PictureOutlined style={{ fontSize:"52px" }} />
          )}
      </AvatarContainer>
      {
        <>
          <Text
            style={{
              bottom: `${entryExtraInfo?.length ?? 0 > 0 ? "0px" : "18px"}`,
              maxWidth: "130px",
              textAlign: "center",
              position: "relative",
            }}
            ellipsis={{ tooltip: entryBaseName }}
          >
            {entryBaseName}
          </Text>
          <Text
            style={{
              bottom: `${entryExtraInfo?.length ?? 0 > 0 ? "0px" : "18px"}`,
              maxWidth: "130px",
              textAlign: "center",
              fontSize: "12px",
              position: "relative",

            }}
            ellipsis={{ tooltip: [...entryExtraInfo ?? []].join(" / ") }}
          >
            {[...entryExtraInfo ?? []].join(" / ")}
          </Text>
        </>
      }
    </ItemContainer>
  );
};
