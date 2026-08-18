import { Grid, Layout } from "antd";
import { Outlet } from "react-router-dom";
import { SideNavigation } from "src/app/layout/SideNavigation";
import { TopBar } from "src/app/layout/TopBar";
import { NotificationPopupPoller } from "src/features/notification/NotificationPopupPoller";
import { styled } from "styled-components";

const { useBreakpoint } = Grid;

const Root = styled(Layout)`
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
`;

const Body = styled(Layout)`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Content = styled(Layout.Content)`
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px;
  background: ${({ theme }) => theme.token.colorBgLayout};
`;

export function AppLayout() {
  const screens = useBreakpoint();
  const desktop = screens.lg !== false;

  return (
    <Root>
      <NotificationPopupPoller />
      <TopBar showNavigationButton={!desktop} />
      <Body>
        <SideNavigation desktop={desktop} />
        <Content>
          <Outlet />
        </Content>
      </Body>
    </Root>
  );
}
