import {
  BellOutlined,
  BulbOutlined,
  DownOutlined,
  GlobalOutlined,
  LinkOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Badge, Button, Dropdown, Space, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMetadataQuery } from "src/api/metadata";
import { useUiConfigQuery } from "src/api/uiConfig";
import { useLayoutStore } from "src/app/layout/layoutStore";
import { useUnreadNotificationCountQuery } from "src/features/notification/queries";
import { useLogoutMutation, useProfileQuery } from "src/features/profile";
import { useUiExtensionNavbarLinks, useUiExtensionsQuery } from "src/features/uiExtension";
import { isHttpUrl, isSafeExtensionPath } from "src/features/uiExtension/paths";
import { languageDefinitions } from "src/i18n/languages";
import { getScowPath } from "src/config/runtime";
import { styled } from "styled-components";

const Header = styled.header`
  flex: 0 0 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: ${({ theme }) => theme.token.colorBgContainer};
  border-bottom: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  z-index: 100;
`;

const Brand = styled.button`
  border: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const Logo = styled.img`
  height: 30px;
  max-width: 180px;
  object-fit: contain;
`;

const BrandFallback = styled.span`
  color: ${({ theme }) => theme.token.colorPrimary};
  font-size: 18px;
  font-weight: 600;
`;

const UserName = styled.span`
  margin: 0 8px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const ExtensionLinkIcon = styled.img`
  width: 16px;
  height: 16px;
  object-fit: contain;
`;

export function TopBar({ showNavigationButton }: { showNavigationButton: boolean }) {
  const { i18n, t } = useTranslation("common");
  const navigate = useNavigate();
  const setMobileOpen = useLayoutStore((state) => state.setMobileNavigationOpen);
  const metadataQuery = useMetadataQuery();
  const uiConfigQuery = useUiConfigQuery(metadataQuery.data);
  const extensionsQuery = useUiExtensionsQuery(metadataQuery.data);
  const extensionLinksQuery = useUiExtensionNavbarLinks(
    extensionsQuery.data ?? [],
    uiConfigQuery.data?.userToken,
    uiConfigQuery.data?.darkMode ?? false,
    i18n.language,
  );
  const misEnabled = Boolean(metadataQuery.data?.components.mis);
  const profileQuery = useProfileQuery(misEnabled);
  const logoutMutation = useLogoutMutation();
  const notificationEnabled = metadataQuery.data ? Boolean(metadataQuery.data.components.notification) : true;
  const unreadCountQuery = useUnreadNotificationCountQuery(i18n.language, notificationEnabled);
  const systemLanguageConfig = uiConfigQuery.data?.systemLanguageConfig;
  const enabledLanguageDefinitions = languageDefinitions.filter(
    ({ id }) => !systemLanguageConfig || systemLanguageConfig.enabledLanguages.includes(id),
  );
  const languageSwitchEnabled = systemLanguageConfig?.isUsingI18n ?? true;
  const user = profileQuery.data?.user;
  const logoUrl = uiConfigQuery.data?.brandingApiBase
    ? `${uiConfigQuery.data.brandingApiBase}/logo?type=logo&preferDark=${uiConfigQuery.data.darkMode ? "true" : "false"}`
    : undefined;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const hideExtensionLinkText = extensionLinksQuery.data.length >= 5;
  const openExtensionLink = (path: string, openInNewPage: boolean) => {
    if (!isSafeExtensionPath(path)) return;
    const target = isHttpUrl(path) ? path : getScowPath(path);
    if (openInNewPage) {
      window.open(target, "_blank", "noopener,noreferrer");
    } else if (isHttpUrl(path)) {
      window.location.assign(path);
    } else {
      void navigate(path);
    }
  };

  return (
    <Header>
      <Brand aria-label={t("header.home", "返回首页")} onClick={() => void navigate("/dashboard")}>
        {logoUrl && !logoFailed ? (
          <Logo src={logoUrl} alt="" onError={() => setLogoFailed(true)} />
        ) : (
          <BrandFallback>{/* i18next-instrument-ignore */}SCOW</BrandFallback>
        )}
      </Brand>
      <Space size={4}>
        {extensionLinksQuery.data.map((link) => {
          const button = (
            <Button
              key={link.id}
              aria-label={link.text}
              type="text"
              icon={link.icon ? <ExtensionLinkIcon src={link.icon.src} alt={link.icon.alt ?? ""} /> : <LinkOutlined />}
              onClick={() => openExtensionLink(link.path, link.openInNewPage)}
            >
              {hideExtensionLinkText ? null : link.text}
            </Button>
          );
          return hideExtensionLinkText ? (
            <Tooltip key={link.id} title={link.text}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
        {notificationEnabled ? (
          <Tooltip title={t("header.notification", "通知")}>
            <Badge count={unreadCountQuery.data ?? 0} overflowCount={99} size="small">
              <Button
                aria-label={t("header.notification", "通知")}
                type="text"
                icon={<BellOutlined />}
                onClick={() => void navigate("/notification/messages")}
              />
            </Badge>
          </Tooltip>
        ) : null}
        <Tooltip title={t("header.theme", "主题")}>
          <Button aria-label={t("header.theme", "主题")} type="text" icon={<BulbOutlined />} />
        </Tooltip>
        {languageSwitchEnabled ? (
          <Dropdown
            menu={{
              selectedKeys: [i18n.language],
              items: enabledLanguageDefinitions.map((language) => ({
                key: language.id,
                label: language.label(t),
              })),
              onClick: ({ key }) => void i18n.changeLanguage(key),
            }}
          >
            <Button aria-label={t("header.language", "语言")} type="text" icon={<GlobalOutlined />} />
          </Dropdown>
        ) : null}
        {user ? (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "profile", label: t("header.profile", "个人信息") },
                { key: "logout", label: t("header.logout", "退出登录") },
              ],
              onClick: ({ key }) => {
                if (key === "profile") void navigate("/profile");
                if (key === "logout") logoutMutation.mutate();
              },
            }}
          >
            <Button aria-label={t("header.userMenu", "用户菜单")} type="text" loading={logoutMutation.isPending}>
              <UserOutlined />
              <UserName>{user.name ?? user.identityId}</UserName>
              <DownOutlined />
            </Button>
          </Dropdown>
        ) : null}
        {showNavigationButton ? (
          <Button
            aria-label={t("header.openNavigation", "打开导航")}
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileOpen(true)}
          />
        ) : null}
      </Space>
    </Header>
  );
}
