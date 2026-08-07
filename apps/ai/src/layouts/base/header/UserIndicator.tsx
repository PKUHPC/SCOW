"use client";
import { DownOutlined } from "@ant-design/icons";
import { EXTERNAL_URL_PREFIX } from "@scow/lib-web/build/layouts/base/common";
import { UserInfo, UserLink } from "@scow/lib-web/build/layouts/base/types";
import { getCurrentLangLibWebText } from "@scow/lib-web/build/utils/libWebI18n/libI18n";
import { Dropdown, theme, Typography } from "antd";
import Link from "next/link";
import React from "react";
import { UserIcon } from "src/icons/headIcons";
import { antdBreakpoints } from "src/layouts/base/constants";
import { styled } from "styled-components";

const { useToken } = theme;

interface Props {
  user: UserInfo | undefined;
  logout: (() => void) | undefined;
  userLinks?: UserLink[];
  languageId: string;
  showOperationLog?: boolean;
  operationLogUrl?: string;
}

const Container = styled.div`
  white-space: nowrap;
  .ant-dropdown-open {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }
`;

const InlineBlockA = styled.a`
  cursor: pointer;
  line-height: 36px;
  display: inline-flex;
  color: #434343 !important;
  font-size: 14px;
`;

const HiddenOnSmallScreen = styled.span`
  margin-left: 8px;
  @media (max-width: ${antdBreakpoints.md}px) {
    display: none;
  }
`;

export const UserIndicator: React.FC<Props> = ({
  user,
  logout,
  userLinks,
  languageId,
  showOperationLog,
  operationLogUrl,
}) => {
  const { token } = useToken();
  return (
    <Container>
      {user ? (
        <Dropdown
          trigger={["click"]}
          overlayClassName="head-navigation-user-indicator"
          menu={{
            items: [
              {
                key: "profileLink",
                label: <Link href="/profile">{getCurrentLangLibWebText(languageId, "userIndicatorInfo")}</Link>,
              },
              ...(showOperationLog
                ? [
                    {
                      key: "operationLogLink",
                      label: (
                        <Typography.Link href={operationLogUrl} target="_blank" rel="noopener noreferrer">
                          {getCurrentLangLibWebText(languageId, "userIndicatorOperationLog")}
                        </Typography.Link>
                      ),
                    },
                  ]
                : []),
              ...(userLinks
                ? userLinks.map((link) => {
                    return {
                      key: link.text,
                      label: EXTERNAL_URL_PREFIX.some((pref) => link.url.startsWith(pref)) ? (
                        <Typography.Link
                          href={`${link.url}?token=${user.token}`}
                          target={link.openInNewPage ? "_blank" : "_self"}
                        >
                          {link.text}
                        </Typography.Link>
                      ) : (
                        <Link href={`${link.url}?token=${user.token}`} target={link.openInNewPage ? "_blank" : "_self"}>
                          {link.text}
                        </Link>
                      ),
                    };
                  })
                : []),
              { key: "logout", onClick: logout, label: getCurrentLangLibWebText(languageId, "userIndicatorLogout") },
            ],
          }}
        >
          <InlineBlockA>
            <UserIcon style={{ color: token.colorPrimary }} />
            <HiddenOnSmallScreen>{user.name ?? user.identityId}</HiddenOnSmallScreen>
            <DownOutlined style={{ fontSize: "13px", marginLeft: "12px" }} />
          </InlineBlockA>
        </Dropdown>
      ) : (
        <Link href="/api/auth">{getCurrentLangLibWebText(languageId, "userIndicatorLogin")}</Link>
      )}
    </Container>
  );
};
