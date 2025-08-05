/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

"use client";

import { Grid, Layout } from "antd";
import { usePathname } from "next/navigation";
import React, { PropsWithChildren, useMemo } from "react";
import { useI18n } from "src/i18n";
import { Header } from "src/layouts/base/header";
import { match } from "src/layouts/base/matchers";
import { NavItemProps } from "src/layouts/base/NavItemProps";
import { SideNav } from "src/layouts/base/SideNav";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { arrayContainsElement } from "src/utils/array";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

// import logo from "src/assets/logo-no-text.svg";
const { useBreakpoint } = Grid;

const Root = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const ContentPart = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
`;

const Content = styled(Layout.Content)<{ isDashboard: boolean }>`
  margin: ${(props) => props.isDashboard ? "8px 8px 35px" : "8px"};
  padding: 16px;
  flex: 1;
  background: ${({ theme }) => theme.token.colorBgLayout};
  max-height: ${(props) => props.isDashboard ? "" : "calc(100vh - 78px)"};
  overflow-y: auto;
  .ant-table-wrapper .ant-table {
    scrollbar-color: auto !important;
  }
`;

const StyledLayout = styled(Layout)`
  position: relative;
`;

type Props = PropsWithChildren<{
  routes?: NavItemProps[];
  user?: ClientUserInfo | undefined;
  headerRightContent?: React.ReactNode;
  footerText?: string | undefined;
  versionTag?: string | undefined;
}>;

export const BaseLayout: React.FC<PropsWithChildren<Props>> = ({
  routes = [], children, user = undefined, headerRightContent,
}) => {

  const pathname = usePathname() ?? "";

  // get the first level route
  const firstLevelRoute = useMemo(() => routes.find((x) => match(x, pathname)), [routes, pathname]);

  const { md } = useBreakpoint();

  const sidebarRoutes = md ? firstLevelRoute?.children : routes;

  const hasSidebar = arrayContainsElement(sidebarRoutes);

  const useLogoutMutation = trpc.auth.logout.useMutation();

  const languageId = useI18n().currentLanguage.id;

  return (
    <Root>
      <Header
        pathname={pathname}
        routes={routes}
        user={user}
        logout={() => { useLogoutMutation.mutateAsync().then(() => { location.reload(); }); }}
        userLinks={[]}
        languageId={languageId}
        right={headerRightContent}
      />
      <StyledLayout>
        {
          (hasSidebar) ? (
            <SideNav
              pathname={pathname}
              routes={sidebarRoutes}
            />
          ) : undefined
        }
        <ContentPart>
          <Content isDashboard={pathname === "/dashboard"}>
            {children}
          </Content>
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};

