import { forwardRef, HTMLAttributes } from "react";
import { styled } from "styled-components";

import { EntryItem } from "./EntryItem";

export type CardItemProps = HTMLAttributes<HTMLDivElement> & {
  draggable: boolean;
  transparent?: boolean;
  isDragging?: boolean;
};


export type EntryCardItemProps = CardItemProps & {
  entryBaseName: string,
  entryExtraInfo?: string[];
  id: string,
  iconMap: Record<string, React.ReactElement>;
  publicPath: string,
  icon?: string,
  logoPath?: string;
};

export const EntryCardItem = forwardRef<HTMLDivElement, EntryCardItemProps>
(({ entryBaseName, entryExtraInfo, publicPath, icon, iconMap, logoPath, children, ...props }, ref) => {

  return (
    <CardItem ref={ref} {...props}>
      <EntryItem
        entryBaseName={entryBaseName}
        icon={icon}
        logoPath={logoPath}
        entryExtraInfo={entryExtraInfo}
        publicPath={publicPath}
        iconMap={iconMap}
      />

    </CardItem>
  );
});

const CardItemContainer = styled.div<{
  draggable?: boolean;
  isDragging?: boolean;
  transparent?: boolean;
}>`
  cursor: ${(props) => props.draggable ? (props.isDragging ? "grabbing" : "grab") : "pointer"};
  opacity: ${((props) => props.transparent ? "0.5" : "1")};
  transform: ${(props) => props.isDragging ? "scale(1.05)" : "scale(1)"};
  box-shadow: ${(p) => p.theme.token.boxShadowSecondary};

  background-color: ${(p) => p.theme.token.colorBgElevated};

  padding: 8px;
  height: 172px;
  min-width: 148px;
`;

export const CardItem = forwardRef<HTMLDivElement, CardItemProps>
(({ children, ...props }, ref) => {

  return (
    <CardItemContainer ref={ref} {...props}>
      {children}
    </CardItemContainer>
  );
});

