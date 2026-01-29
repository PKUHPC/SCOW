"use client";

import { calcActiveKeys } from "@scow/lib-web/build/layouts/base/common";
import { SideNav } from "@scow/lib-web/build/layouts/base/SideNav";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { arrayContainsElement } from "@scow/utils";
import { Layout } from "antd";
import { usePathname, useRouter } from "next/navigation";
import React, { PropsWithChildren, useMemo } from "react";
import { styled } from "styled-components";

const ContentPart = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  overflow: hidden;

`;

const Content = styled(Layout.Content)`
  margin: 8px;
  padding: 16px;
  flex: 1;
  background: ${({ theme }) => theme.token.colorBgLayout};
`;

const StyledLayout = styled(Layout)`
  position: relative;
`;

interface Props {
  sidebarRoutes: NavItemProps[];
}
export const BaseLayout: React.FC<PropsWithChildren<Props>> = ({ sidebarRoutes, children }) => {

  const pathname = usePathname() ?? "";
  const router = useRouter();

  const hasSidebar = arrayContainsElement(sidebarRoutes);
  const selectedKeys = useMemo(() =>
    sidebarRoutes
      ? [...calcActiveKeys(sidebarRoutes, pathname)]
      : []
  , [sidebarRoutes, pathname]);

  return (
    <div>
      <StyledLayout>
        {
          hasSidebar && (
            <SideNav
              activeKeys={selectedKeys}
              pathname={pathname}
              routes={sidebarRoutes}
              appRouter={router}
            />
          )
        }
        <ContentPart>
          <Content>
            {children}
          </Content>
        </ContentPart>
      </StyledLayout>
    </div>
  );
};

