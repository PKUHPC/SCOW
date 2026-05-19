import { App, Button, Tabs, Typography } from "antd";
import Link from "next/link";
import Router, { useRouter } from "next/router";
import React from "react";
import { api } from "src/apis";
import { Centered } from "src/components/layouts";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

interface DrawerProps {
  children: React.ReactNode;
}

const Title = styled(Centered)`
  position: relative;
`;

const CompleteButtonContainer = styled.div`
  position: absolute;
  right: 0;
`;

const TabItems = [
  { label: "pageComp.init.initLayout.importUser", href: "/init/importUsers" },
  { label: "pageComp.init.initLayout.userManager", href: "/init/users" },
  { label: "pageComp.init.initLayout.create", href: "/init/createInitAdmin" },
  { label: "pageComp.init.initLayout.edit", href: "/init/jobPriceTable" },
] as const;

const TabsContainer = styled.div`
  .ant-tabs-tab:not(.ant-tabs-tab-active) a {
    color: ${({ theme }) => theme.token.colorText};
  }
`;

const Content = styled.div`
  display: flex;
  justify-content: center;
`;

const ContentInside = styled.div`
  max-width: 1400px;
`;

const p = prefix("pageComp.init.initLayout.");

export const InitTab: React.FC = () => {
  const t = useI18nTranslateToString();

  const router = useRouter();

  return (
    <TabsContainer>
      <Tabs
        centered
        items={TabItems.map(({ label, href }) => ({ key: href, label: <Link href={href}>{t(label)}</Link> }))}
        activeKey={router.asPath}
      />
    </TabsContainer>
  );
};

export const InitDrawer: React.FC<DrawerProps> = ({ children }) => {
  const t = useI18nTranslateToString();

  const { modal } = App.useApp();

  const onOk = async () => {
    // check price item completeness
    const missingPriceItems = await api.getMissingDefaultPriceItems({});

    if (missingPriceItems.items.length > 0) {
      modal.error({
        title: t(p("Incomplete")),
        content: t(p("set")),
      });
      return;
    }

    modal.confirm({
      title: t(p("confirm")),
      content: t(p("confirmText")),
      onOk: () =>
        api.completeInit({}).then(() => {
          modal.success({
            title: t(p("finish")),
            content: t(p("goLogin")),
            closable: false,
            maskClosable: false,
            onOk: () => Router.push("/api/auth"),
          });
        }),
    });
  };

  return (
    <div>
      <Head title={t(p("init"))} />
      <Title>
        <span />
        <Typography.Title>{t(p("init"))}</Typography.Title>
        <CompleteButtonContainer>
          <Button type="primary" onClick={onOk}>
            {t(p("complete"))}
          </Button>
        </CompleteButtonContainer>
      </Title>
      <InitTab />
      <Content>
        <ContentInside>{children}</ContentInside>
      </Content>
    </div>
  );
};
