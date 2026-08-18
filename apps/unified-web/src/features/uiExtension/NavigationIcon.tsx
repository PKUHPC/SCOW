import {
  AccountPartitionsIcon,
  CreateCustomMessageIcon,
  DefaultClustersIcon,
  DefaultPartitionsIcon,
  MessageConfigIcon,
  NotificationIcon,
  SendMessageIcon,
  SubscriptionIcon,
} from "@scow/lib-web/build/extensions/menuIcon";
import { LinkOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { UiExtensionNavigationItem } from "src/features/uiExtension/types";
import { styled } from "styled-components";

const RemoteIcon = styled.img`
  width: 18px;
  height: 18px;
  object-fit: contain;
`;

const svgIconMap = {
  DefaultClustersIcon,
  DefaultPartitionsIcon,
  AccountPartitionsIcon,
  NotificationIcon,
  SubscriptionIcon,
  MessageConfigIcon,
  SendMessageIcon,
  CreateCustomMessageIcon,
};

export function NavigationIcon({ item, fallback }: { item: UiExtensionNavigationItem; fallback?: ReactNode }) {
  if (item.svgIcon && item.svgIcon in svgIconMap) {
    const IconComponent = svgIconMap[item.svgIcon as keyof typeof svgIconMap];
    return <IconComponent />;
  }
  if (item.icon) return <RemoteIcon src={item.icon.src} alt={item.icon.alt ?? ""} />;
  return fallback ?? <LinkOutlined />;
}
