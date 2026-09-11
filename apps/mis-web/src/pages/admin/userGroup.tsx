import { Alert, App, Descriptions, Spin, Switch } from "antd";
import { NextPage } from "next";
import { useEffect, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { ForbiddenPage } from "src/components/errorPages/ForbiddenPage";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AccountGroupInitStatus } from "src/models/admin";
import { PlatformRole } from "src/models/User";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";

const p = prefix("page.admin.systemDebug.userGroup.");

const getAccountGroupStatusPromiseFn = async () => api.getAccountGroupStatus({});

export const UserGroupPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const { isLoading, data: accountGroupStatus, reload } = useAsync({
      promiseFn: getAccountGroupStatusPromiseFn,
    });
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [startedInSession, setStartedInSession] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const { message } = App.useApp();
    const t = useI18nTranslateToString();

    const isInitialized = accountGroupStatus?.accountGroupInitialized === AccountGroupInitStatus.INITIALIZED;
    const isInitializing = accountGroupStatus?.accountGroupInitialized === AccountGroupInitStatus.INITIALIZING;
    const isNotInitialized = !isInitialized && !isInitializing;

    // 初始化中时轮询状态
    useEffect(() => {
      if (!isInitializing) return;
      const interval = setInterval(() => reload(), 5000);
      return () => clearInterval(interval);
    }, [isInitializing]);

    // 初始化完成后弹出成功提示（停留在页面时 或 重新进入页面时）
    useEffect(() => {
      if (!accountGroupStatus) return;
      if (isInitialized && !accountGroupStatus.accountGroupInitConfirmed) {
        setSuccessModalVisible(true);
      }
    }, [accountGroupStatus?.accountGroupInitialized, accountGroupStatus?.accountGroupInitConfirmed]);

    // 本次会话启动的初始化失败时提示
    useEffect(() => {
      if (!accountGroupStatus) return;
      if (startedInSession && isNotInitialized) {
        message.error(t(p("initFailedMessage")));
        setStartedInSession(false);
      }
    }, [accountGroupStatus?.accountGroupInitialized]);

    if (accountGroupStatus?.accountGroupInitConfirmed) {
      return <ForbiddenPage />;
    }

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("title"))} />
        <Alert
          type="info"
          style={{ marginBottom: "4px" }}
          showIcon
          message={(
            <>
              <div>{t(p("alertLine1"))}</div>
              <div>{t(p("alertLine2"))}</div>
            </>
          )}
        />
        <Spin spinning={isLoading}>
          {accountGroupStatus ? (
            <Descriptions bordered column={1} labelStyle={{ width: "40%" }}>
              <Descriptions.Item label={t(p("featureLabel"))}>
                <Switch
                  checked={isInitialized}
                  loading={isInitializing}
                  disabled={isInitialized || isInitializing}
                  onChange={(checked) => {
                    if (!checked) return;
                    setConfirmModalVisible(true);
                  }}
                />
              </Descriptions.Item>
            </Descriptions>
          ) : undefined}
        </Spin>

        {/* 二次确认弹窗 */}
        <StyledModal
          title={t(p("confirmTitle"))}
          open={confirmModalVisible}
          okText={t(p("confirmOk"))}
          cancelText={t(p("confirmCancel"))}
          confirmLoading={confirmLoading}
          onCancel={() => setConfirmModalVisible(false)}
          onOk={async () => {
            setConfirmLoading(true);
            try {
              await api.initAccountGroup({ body: {} });
              setConfirmModalVisible(false);
              setStartedInSession(true);
              message.info(t(p("initializingMessage")));
              reload();
            } finally {
              setConfirmLoading(false);
            }
          }}
        >
          {t(p("confirmContent"))}
        </StyledModal>

        {/* 成功提示弹窗 */}
        <StyledModal
          title={t(p("successTitle"))}
          open={successModalVisible}
          okText={t(p("successOk"))}
          cancelButtonProps={{ style: { display: "none" } }}
          onOk={async () => {
            await api.setAccountGroupInitConfirmed({ body: {} });
            window.location.href = publicConfig.BASE_PATH + "/admin/info";
          }}
        >
          {t(p("successContent"))}
        </StyledModal>
      </div>
    );
  });

export default UserGroupPage;
