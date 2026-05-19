import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Alert, Badge, Descriptions, Divider, Space, Spin } from "antd";
import { NextPage } from "next";
import { useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { DisabledA } from "src/components/DisabledA";
import { ModalButton } from "src/components/ModalLink";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { SetMaxSyncDurationTimeModal } from "src/pageComponents/admin/SetMaxSyncDurationTimeModal";
import { SyncAccountUserHistorySection } from "src/pageComponents/admin/syncAccountUserHistorySection";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const promiseFn = async () => api.getSyncBlockStatusJobInfo({});
const p = prefix("page.admin.systemDebug.syncClusterAccountUser.");

export const SlurmBlockStatusPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    const { isLoading, data, reload } = useAsync({
      promiseFn,
    });

    const [fetching, setFetching] = useState(false);
    const [changingState, setChangingState] = useState(false);

    const SetMaxSyncDurationTimeButton = ModalButton(SetMaxSyncDurationTimeModal, { type: "link", disabled: fetching });

    return (
      <div>
        <Head title={t(p("syncUserAccount"))} />
        <PageTitle titleText={t(p("syncUserAccount"))} isLoading={isLoading} reload={reload} />

        <Alert
          type="info"
          style={{ marginBottom: "4px" }}
          showIcon
          message={
            <>
              <div>{t(p("alertInfo"))}</div>
              <div>{t(p("maxSyncDurationExplanation"))}</div>
            </>
          }
        />

        <Spin spinning={isLoading}>
          {data ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label={t(p("periodicSyncUserAccountInfo"))}>
                <Space
                  style={{
                    textAlign: "left",
                    display: "flex",
                    padding: "0",
                    height: "auto",
                  }}
                >
                  <span style={{ paddingRight: "14px" }}>
                    {data.syncStarted ? (
                      <Badge status="success" text={t(p("turnedOn"))} />
                    ) : (
                      <Badge status="error" text={t(p("paused"))} />
                    )}
                  </span>
                  <DisabledA
                    onClick={() => {
                      setChangingState(true);
                      api
                        .setSyncBlockStatusState({ query: { started: !data.syncStarted } })
                        .then(() => reload())
                        .finally(() => setChangingState(false));
                    }}
                    disabled={changingState}
                  >
                    {data.syncStarted ? t(p("stopSync")) : t(p("startSync"))}
                  </DisabledA>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t(p("jobSyncCycle"))}>{data.schedule}</Descriptions.Item>
              <Descriptions.Item label={t(p("maxSyncDurationMinutes"))}>
                {publicConfig.MAX_SYNC_DURATION_MINUTES} {t(p("minuteUnit"))}
              </Descriptions.Item>
              <Descriptions.Item label={t(p("lastSyncTime"))}>
                <Space
                  style={{
                    textAlign: "left",
                    display: "flex",
                    padding: "0",
                    height: "auto",
                  }}
                >
                  {data.lastSyncTime ? formatDateTime(data.lastSyncTime) : t(p("notSynced"))}
                  <SetMaxSyncDurationTimeButton reload={reload} setFetching={setFetching}>
                    {t(p("syncSchedulerUserAccountNow"))}
                  </SetMaxSyncDurationTimeButton>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          ) : undefined}
        </Spin>

        <Divider />
        <SyncAccountUserHistorySection reload={() => reload()} />
      </div>
    );
  },
);

export default SlurmBlockStatusPage;
