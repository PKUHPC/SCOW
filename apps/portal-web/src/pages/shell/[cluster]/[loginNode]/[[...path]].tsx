import "@xterm/xterm/css/xterm.css";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button, Popover, Space, Spin, Typography } from "antd";
import { NextPage } from "next";
import dynamic from "next/dynamic";
import Router, { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis/api";
import { requireAuth } from "src/auth/requireAuth";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { Localized, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const { Text } = Typography;

const Container = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  z-index: 2000;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  background-color: #333;

  h2 {
    color: white;
    margin: 0px;
  }

  .ant-popover-content p {
    margin: 0;
  }
`;

const TerminalContainer = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
  background-color: black;
`;

const Black = styled.div`
  height: 100%;
  background-color: black;
`;

const DynamicShellComponent = dynamic(() => import("src/pageComponents/shell/Shell").then((x) => x.Shell), {
  ssr: false,
  loading: Black,
});

export const ShellPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  if (!publicConfig.ENABLE_SHELL) {
    return <NotFoundPage />;
  }

  const languageId = useI18n().currentLanguage.id;

  const router = useRouter();

  const cluster = router.query.cluster as string;
  const loginNode = router.query.loginNode as string;
  const paths = router.query.path as string[] | undefined;

  const { currentClusters } = useStore(ClusterInfoStore);

  if (!currentClusters.find((x) => x.id === cluster)) {
    return <ClusterNotAvailablePage />;
  }

  const { loginNodes } = useStore(LoginNodeStore);
  const currentLoginNodeName = loginNodes[cluster].find((x) => x.address === loginNode)?.name ?? loginNode;

  const headerRef = useRef<HTMLDivElement>(null);

  const clusterName = getI18nConfigCurrentText(
    currentClusters.find((x) => x.id === cluster)?.name || cluster,
    languageId,
  );

  const t = useI18nTranslateToString();

  // 支持通过 URL 查询参数控制是否以 root 身份登录，仅当平台管理员且明确声明才启用
  const searchParams = new URLSearchParams(window.location.search);
  const getUseRoot = searchParams.get("useRoot");
  const useRoot = getUseRoot === "true"; // 增加调用一个接口问mis是否是平台管理员且有了配置
  const identityId = userStore.user.identityId;

  // 状态用于保存 API 检查结果：用户是否被授权使用 root shell
  const [isRootShellEnabled, setIsRootShellEnabled] = useState(false);
  // 状态用于控制加载中，初始设为 true
  const [isLoadingRootCheck, setIsLoadingRootCheck] = useState(true);

  useEffect(() => {
    // 如果 useRoot 为 false，则无需检查 API
    if (!useRoot) {
      setIsRootShellEnabled(false);
      setIsLoadingRootCheck(false);
      return;
    }

    const checkRootAccess = async () => {
      try {
        const result = await api.getIsUserEnabledRootShell({});
        setIsRootShellEnabled(result.result === true);
      } catch (e) {
        console.error("Failed to check root shell status:", e);
        setIsRootShellEnabled(false);
      } finally {
        setIsLoadingRootCheck(false);
      }
    };

    checkRootAccess();
  }, [identityId, useRoot]);

  if (isLoadingRootCheck) {
    return <Spin />;
  }

  const useRootEnabled = useRoot && isRootShellEnabled;
  const userId = useRootEnabled ? "root" : identityId;

  return (
    <Container>
      <Head title={`${cluster}${t("pages.shell.loginNode.title")}`} />
      <Header ref={headerRef}>
        <h2>
          <Localized id="pages.shell.loginNode.content" args={[userId, clusterName, currentLoginNodeName]} />
        </h2>
        <Space wrap>
          <Button onClick={() => Router.reload()}>{t("pages.shell.loginNode.reloadButton")}</Button>
          {!useRootEnabled && (
            <Popover
              title={t("pages.shell.loginNode.popoverTitle")}
              trigger="hover"
              placement="bottom"
              zIndex={2000}
              getPopupContainer={() => headerRef.current || document.body}
              content={() => (
                <div>
                  <p>
                    <b>{t("pages.shell.loginNode.popoverContent1")}</b>：<Text code>sopen</Text>
                    {t("pages.shell.loginNode.popoverContent2")}
                  </p>
                  <p>
                    <b>{t("pages.shell.loginNode.popoverContent12")}</b>：<Text code>sup</Text>
                    {t("pages.shell.loginNode.popoverContent13")}
                  </p>
                  <p>
                    <b>{t("pages.shell.loginNode.popoverContent3")}</b>：
                    <Text code>sdown [{t("pages.shell.loginNode.popoverContentFile")}]</Text>
                    {t("pages.shell.loginNode.popoverContent4")}
                    <Text code>sdown [{t("pages.shell.loginNode.popoverContentFile")}]</Text>
                    {t("pages.shell.loginNode.popoverContent5")}
                    <br />
                    {t("pages.shell.loginNode.popoverContent8")}
                    <Text code>sdown hello.txt</Text>
                  </p>
                  <p>
                    <b>{t("pages.shell.loginNode.popoverContent9")}</b>：
                    <Text code>sedit [{t("pages.shell.loginNode.popoverContentFile")}]</Text>
                    {t("pages.shell.loginNode.popoverContent10")}
                    <Text code>sedit [{t("pages.shell.loginNode.popoverContentFile")}]</Text>
                    {t("pages.shell.loginNode.popoverContent11")}
                    <br />
                    {t("pages.shell.loginNode.popoverContent8")}
                    <Text code>sedit hello.txt</Text>
                  </p>
                  <p>
                    {t("pages.shell.loginNode.popoverContent6")}
                    <Text code>sopen</Text>
                    {t("pages.shell.loginNode.popoverContent7")}
                  </p>
                </div>
              )}
            >
              <Button>{t("pages.shell.loginNode.command")}</Button>
            </Popover>
          )}
        </Space>
      </Header>
      <TerminalContainer>
        <DynamicShellComponent
          path={paths ? "/" + paths.join("/") : ""}
          userId={userId}
          cluster={cluster}
          loginNode={loginNode}
          useRootEnabled={useRootEnabled}
        />
      </TerminalContainer>
    </Container>
  );
});

export default ShellPage;
