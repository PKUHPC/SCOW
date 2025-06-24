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

import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Alert, App, Badge, Descriptions, Space, Spin } from "antd";
import { NextPage } from "next";
import { useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { DisabledA } from "src/components/DisabledA";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { Head } from "src/utils/head";

const promiseFn = async () => api.getFetchJobInfo({});

const p = prefix("page.admin.systemDebug.fetchJobs.");

export const FetchJobsInfoPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const { isLoading, data, reload } = useAsync({
      promiseFn,
    });

    const t = useI18nTranslateToString();

    const { message } = App.useApp();

    const [fetching, setFetching] = useState(false);
    const [changingState, setChangingState] = useState(false);

    return (
      <div>
        <Head title={t(p("jobInfoSync"))} />
        <PageTitle titleText={t(p("jobInfoSync"))} isLoading={isLoading} reload={reload} />
        <Alert
          type="info"
          style={{ marginBottom: "4px" }}
          showIcon
          message={(
            <div>
              {t(p("alertMessage"))}
            </div>
          )}
        />
        <Spin spinning={isLoading}>
          {
            data ? (
              <Descriptions bordered column={1}>
                <Descriptions.Item label={t(p("periodicSyncJobInfo"))}>
                  <Space>
                    {data.fetchStarted
                      ? <Badge status="success" text={t(p("turnedOn"))} />
                      : <Badge status="error" text={t(p("paused"))} />
                    }
                    <DisabledA
                      onClick={() => {
                        setChangingState(true);
                        api.setFetchState({ query: { started: !data.fetchStarted } })
                          .then(() => reload())
                          .finally(() => setChangingState(false));
                      }}
                      disabled={changingState}
                    >
                      {data.fetchStarted ? t(p("stopSync")) : t(p("startSync"))}
                    </DisabledA>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t(p("jobSyncCycle"))}>
                  {data.schedule}
                </Descriptions.Item>
                <Descriptions.Item label={t(p("lastSyncTime"))}>
                  <Space>
                    <span>
                      {data.lastFetchTime ? formatDateTime(data.lastFetchTime) : t(p("notSynced"))}
                    </span>
                    <DisabledA
                      onClick={() => {
                        setFetching(true);
                        api.fetchJobs({})
                          .httpError(409, () => {
                            message.error(t(p("accountUserSyncRunning")));
                          })
                          .then(({ newJobsCount }) => {
                            message.success(t(p("jobSyncSuccessMessage"), [newJobsCount]));
                            reload();
                          })
                          .finally(() => setFetching(false));
                      }}
                      disabled={fetching}
                    >
                      {t(p("syncJobNow"))}
                    </DisabledA>
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            ) : undefined
          }
        </Spin>
      </div>
    );
  });

export default FetchJobsInfoPage;

