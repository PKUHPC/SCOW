import { DashboardOutlined, FolderOpenOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Tooltip } from "antd";
import { ItemType } from "antd/es/menu/interface";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useMetadataQuery } from "src/api/metadata";
import { useUiConfigQuery } from "src/api/uiConfig";
import { useLayoutStore } from "src/app/layout/layoutStore";
import { sidebarModuleDefinitions } from "src/app/router/modules";
import { getScowPath } from "src/config/runtime";
import { NavigationIcon } from "src/features/uiExtension/NavigationIcon";
import {
  useUiExtensionNavigationQuery,
  useUiExtensionsQuery,
  type UiExtensionNavigationItem,
  type UiExtensionSource,
} from "src/features/uiExtension";
import { isHttpUrl, isSafeExtensionPath } from "src/features/uiExtension/paths";
import type { ModuleDefinition } from "src/shared/module";
import { styled } from "styled-components";

const NavigationSider = styled(Layout.Sider)`
  height: 100%;
  overflow: hidden;
  border-right: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  background: ${({ theme }) => theme.token.colorBgContainer} !important;

  .ant-layout-sider-children {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`;

const NavigationMenu = styled(Menu)`
  flex: 1;
  overflow-y: auto;
  border-inline-end: 0 !important;
  padding: 12px 8px;
`;

const CollapseArea = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px 12px;
  border-top: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
`;

const toExtensionNavigationItems = (
  module: ModuleDefinition,
  translate: (key: string, defaultValue: string) => string,
): UiExtensionNavigationItem[] =>
  module.children.map((route) => ({
    path: `/${route.path}`,
    text: route.title(translate),
  }));

const isActivePath = (pathname: string, path: string) =>
  !isHttpUrl(path) && (pathname === path || pathname.startsWith(`${path}/`));

const isNavigationActive = (item: UiExtensionNavigationItem, pathname: string): boolean =>
  isActivePath(pathname, item.path) || Boolean(item.children?.some((child) => isNavigationActive(child, pathname)));

const toMenuItems = (items: UiExtensionNavigationItem[], pathname: string): ItemType[] =>
  items.flatMap((item) => {
    if (item.hideIfNotActive && !isNavigationActive(item, pathname)) return [];
    return [{
      key: item.path,
      icon: <NavigationIcon item={item} />,
      label: item.text,
      children: item.children ? toMenuItems(item.children, pathname) : undefined,
    }];
  });

const createItems = (
  modules: ModuleDefinition[],
  translate: (key: string, defaultValue: string) => string,
  navigationBySource: Partial<Record<UiExtensionSource, UiExtensionNavigationItem[]>>,
  pathname: string,
): ItemType[] => [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: translate("dashboard:dashboard.title", "平台仪表盘"),
  },
  {
    key: "/files",
    icon: <FolderOpenOutlined />,
    label: translate("files.title", "文件管理"),
  },
  ...modules.map((module) => ({
    key: module.path,
    icon: module.icon,
    label: module.title(translate),
    children:
      module.id === "portal" || module.id === "ai"
        ? toMenuItems(navigationBySource[module.id] ?? [], pathname)
        : module.children.map((route) => ({
            key: `${module.path}/${route.path}`,
            label: route.title(translate),
          })),
  })),
];

const flattenNavigations = (items: UiExtensionNavigationItem[]): UiExtensionNavigationItem[] =>
  items.flatMap((item) => [item, ...(item.children ? flattenNavigations(item.children) : [])]);

export function SideNavigation({ desktop }: { desktop: boolean }) {
  const { i18n, t } = useTranslation(["common", "dashboard", "portal", "ai", "quantum"]);
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useLayoutStore((state) => state.navigationCollapsed);
  const mobileOpen = useLayoutStore((state) => state.mobileNavigationOpen);
  const toggleCollapsed = useLayoutStore((state) => state.toggleNavigationCollapsed);
  const setMobileOpen = useLayoutStore((state) => state.setMobileNavigationOpen);
  const metadataQuery = useMetadataQuery();
  const uiConfigQuery = useUiConfigQuery(metadataQuery.data);
  const extensionsQuery = useUiExtensionsQuery(metadataQuery.data);
  const enabledModules = useMemo(
    () =>
      metadataQuery.data
        ? sidebarModuleDefinitions.filter((module) => Boolean(metadataQuery.data.components[module.id]))
        : sidebarModuleDefinitions,
    [metadataQuery.data],
  );
  const portalModule = sidebarModuleDefinitions.find((module) => module.id === "portal")!;
  const aiModule = sidebarModuleDefinitions.find((module) => module.id === "ai")!;
  const portalOriginalItems = useMemo(() => toExtensionNavigationItems(portalModule, t), [portalModule, t]);
  const aiOriginalItems = useMemo(() => toExtensionNavigationItems(aiModule, t), [aiModule, t]);
  const portalNavigationQuery = useUiExtensionNavigationQuery(
    "portal",
    portalOriginalItems,
    extensionsQuery.data ?? [],
    uiConfigQuery.data?.userToken,
    uiConfigQuery.data?.darkMode ?? false,
    i18n.language,
  );
  const aiNavigationQuery = useUiExtensionNavigationQuery(
    "ai",
    aiOriginalItems,
    extensionsQuery.data ?? [],
    uiConfigQuery.data?.userToken,
    uiConfigQuery.data?.darkMode ?? false,
    i18n.language,
  );
  const navigationBySource = useMemo(
    () => ({ portal: portalNavigationQuery.data, ai: aiNavigationQuery.data }),
    [aiNavigationQuery.data, portalNavigationQuery.data],
  );
  const items = useMemo(
    () => createItems(enabledModules, t, navigationBySource, location.pathname),
    [enabledModules, location.pathname, navigationBySource, t],
  );
  const extensionNavigationByPath = useMemo(
    () =>
      new Map(
        [...flattenNavigations(portalNavigationQuery.data), ...flattenNavigations(aiNavigationQuery.data)].map((item) => [
          item.path,
          item,
        ]),
      ),
    [aiNavigationQuery.data, portalNavigationQuery.data],
  );
  const extensionSelectedKey = [...extensionNavigationByPath.keys()]
    .sort((left, right) => right.length - left.length)
    .find((path) => isActivePath(location.pathname, path));
  const selectedKey =
    location.pathname === "/dashboard"
      ? "/dashboard"
      : location.pathname === "/files" || location.pathname.startsWith("/files/")
        ? "/files"
      : extensionSelectedKey ?? enabledModules
          .flatMap((module) => module.children.map((route) => `${module.path}/${route.path}`))
          .find((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const openKey = enabledModules.find(
    (module) => location.pathname === module.path || location.pathname.startsWith(`${module.path}/`),
  )?.path;

  const menu = (
    <NavigationMenu
      mode="inline"
      items={items}
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultOpenKeys={openKey ? [openKey] : []}
      onClick={({ key }) => {
        const extensionItem = extensionNavigationByPath.get(key);
        const target = extensionItem?.clickToPath ?? key;
        if (!isSafeExtensionPath(target)) return;
        if (extensionItem?.openInNewPage) {
          window.open(isHttpUrl(target) ? target : getScowPath(target), "_blank", "noopener,noreferrer");
        } else if (isHttpUrl(target)) {
          window.location.assign(target);
        } else {
          void navigate(target);
        }
        setMobileOpen(false);
      }}
    />
  );

  if (!desktop) {
    return (
      <Drawer open={mobileOpen} placement="left" width={280} closable={false} onClose={() => setMobileOpen(false)}>
        {menu}
      </Drawer>
    );
  }

  return (
    <NavigationSider width={232} collapsedWidth={64} collapsed={collapsed} trigger={null}>
      {menu}
      <CollapseArea>
        <Tooltip
          title={collapsed ? t("navigation.expand", "展开导航") : t("navigation.collapse", "收起导航")}
          placement="right"
        >
          <Button
            aria-label={collapsed ? t("navigation.expand", "展开导航") : t("navigation.collapse", "收起导航")}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            type="text"
            onClick={toggleCollapsed}
          />
        </Tooltip>
      </CollapseArea>
    </NavigationSider>
  );
}
