import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { Alert, App, Descriptions, Spin, Switch } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { NUMERIC_GROUP_NAME_RESOLUTION_FAILED } from "src/utils/constants";
import { Head } from "src/utils/head";

type State = "DISABLED" | "ENABLING" | "ENABLED";

const p = prefix("page.admin.accountStorageQuota.");

const DOTS = [".", "..", "..."];

function AnimatedInitializing({ baseText }: { baseText: string }) {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setDotIndex((i) => (i + 1) % DOTS.length), 500);
    return () => clearInterval(id);
  }, []);

  return <>{baseText}{DOTS[dotIndex]}</>;
}


export const AccountStorageQuotaPage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(() => {

    const t = useI18nTranslateToString();
    const router = useRouter();
    const { modal } = App.useApp();
    const clusterStore = useStore(ClusterInfoStore);

    const [state, setState] = useState<State>("DISABLED");
    const [pageLoading, setPageLoading] = useState(true);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [successVisible, setSuccessVisible] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    const fetchState = () => api.getAccountStorageQuotaState({});

    const startPolling = () => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        const result = await fetchState();
        if (!result) return;
        setState(result.state);
        if (result.state !== "ENABLING") {
          stopPolling();
          if (result.state === "ENABLED") {
            setSuccessVisible(true);
          } else if (result.state === "DISABLED") {
            modal.error({
              title: t(p("initFailTitle")),
              content: t(p("initFailContent")),
            });
          }
        }
      }, 10000);
    };

    useEffect(() => {
      fetchState().then((result) => {
        setPageLoading(false);
        if (!result) return;
        setState(result.state);
        if (result.state === "ENABLED") {
          if (result.confirmed) {
            clusterStore.setAccountStorageQuotaConfirmed(true);
            router.replace("/admin/info");
          } else {
            setSuccessVisible(true);
          }
        } else if (result.state === "ENABLING") {
          startPolling();
        }
      });
      return () => stopPolling();
    }, []);

    const handleToggle = (checked: boolean) => {
      if (checked && state === "DISABLED") {
        setConfirmVisible(true);
      }
    };

    const handleConfirmEnable = () => {
      setConfirmVisible(false);
      setState("ENABLING");
      api.enableAccountStorageQuota({})
        .httpError(409, (e) => {
          setState("DISABLED");
          let content: string;
          if (e.code === "USER_GROUP_NOT_ENABLED") {
            content = t(p("userGroupNotEnabledError"));
          } else if (e.code === "ALREADY_ENABLED_OR_ENABLING") {
            content = t(p("alreadyEnabledError"));
          } else if (e.code === "MULTI_ACCOUNT_USERS") {
            content = t(p("multiAccountUsersError"), [e.users ?? ""]);
          } else if (e.code === "MULTI_GROUP_USERS") {
            content = t(p("multiGroupUsersError"), [e.users ?? ""]);
          } else if (e.code === "DEFAULT_GROUP_NOT_REMOVED") {
            content = t(p("defaultGroupNotRemovedError"), [e.users ?? ""]);
          } else {
            content = t(p("initFailContent"));
          }
          modal.error({ title: t(p("initFailTitle")), content });
        })
        .httpError(500, (e) => {
          setState("DISABLED");
          const content = e?.code === NUMERIC_GROUP_NAME_RESOLUTION_FAILED
            ? `${t(p("initFailContent"))} ${t("common.groupNameResolutionFailed")}${e.details ? ` ${e.details}` : ""}`
            : t(p("initFailContent"));
          modal.error({ title: t(p("initFailTitle")), content });
        })
        .then(() => {
          startPolling();
        })
        .catch(() => {
          setState("DISABLED");
        });
    };

    const handleConfirmSuccess = async () => {
      await api.confirmAccountStorageQuota({});
      clusterStore.setAccountStorageQuotaConfirmed(true);
      router.push("/admin/info");
    };

    return (
      <div>
        <Head title={t(p("pageTitle"))} />
        <PageTitle titleText={t(p("pageTitle"))} />
        <Alert
          type="info"
          style={{ marginBottom: "4px" }}
          showIcon
          message={(
            <>
              <div>{t(p("description"))}</div>
              <div>{t(p("descriptionNote"))}</div>
            </>
          )}
        />
        <Spin spinning={pageLoading}>
          {!pageLoading ? (
            <Descriptions bordered column={1} labelStyle={{ width: "40%" }}>
              <Descriptions.Item label={t(p("switchLabel"))}>
                <Switch
                  checked={state !== "DISABLED"}
                  disabled={state === "ENABLING" || state === "ENABLED"}
                  loading={state === "ENABLING"}
                  onChange={handleToggle}
                />
                {state === "ENABLING" && (
                  <span style={{ marginLeft: 12, color: "#888" }}>
                    <AnimatedInitializing baseText={t(p("initializingBase"))} />
                  </span>
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : undefined}
        </Spin>

        {/* 二次确认弹窗 */}
        <StyledModal
          title={<b>{t(p("enableConfirmTitle"))}</b>}
          open={confirmVisible}
          okText={t(p("confirmEnable"))}
          cancelText={t(p("cancel"))}
          onCancel={() => {
            setConfirmVisible(false);
            setState("DISABLED");
          }}
          onOk={handleConfirmEnable}
        >
          {t(p("enableConfirmContent"))}
        </StyledModal>

        {/* 成功提示弹窗 */}
        <StyledModal
          title={t(p("successTitle"))}
          open={successVisible}
          okText={t(p("confirm"))}
          closable={false}
          maskClosable={false}
          cancelButtonProps={{ style: { display: "none" } }}
          onOk={handleConfirmSuccess}
        >
          {t(p("successContent"))}
        </StyledModal>
      </div>
    );
  });

export default AccountStorageQuotaPage;
