import { Button, ButtonProps } from "antd";
import { PropsWithChildren } from "react";
import styled from "styled-components";

const StyleNoShadowButton = styled(Button)`
  box-shadow: none !important;
`;

export const NoShadowButton: React.FC<PropsWithChildren<ButtonProps>> = ({ children, ...rest }) => {
  return <StyleNoShadowButton {...rest}>{children}</StyleNoShadowButton>;
};
