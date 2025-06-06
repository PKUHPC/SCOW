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

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber, compareTimeAsSeconds } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, Checkbox, Form, Input, Popconfirm, Space, Table, TableColumnsType, Tooltip } from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { useRouter } from "next/router";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { calculateAppRemainingTime, compareState } from "src/models/job";
import { ConnectTopAppLink } from "src/pageComponents/app/ConnectToAppLink";
import { Cluster } from "src/utils/cluster";

interface FilterForm {
  appJobName: string | undefined
}

interface Props {
  cluster: Cluster;
}

const p = prefix("pageComp.app.appSessionTable.");

export const AppSessionsTable: React.FC<Props> = ({ cluster }) => {

  const [query, setQuery] = useState<FilterForm>(() => {
    return { appJobName: undefined };
  });
  const [form] = Form.useForm<FilterForm>();

  const t = useI18nTranslateToString();

  const { message } = App.useApp();

  const router = useRouter();

  const [connectivityRefreshToken, setConnectivityRefreshToken] = useState(false);

  const [onlyNotEnded, setOnlyNotEnded] = useState(false);

  const { data, isLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {
      // List all desktop
      const { sessions } = await api.getAppSessions({ query: { cluster: cluster.id } });

      return sessions.map((x) => ({
        ...x,
        jobName:x.jobName ? x.jobName : x.sessionId,
        remainingTime: x.state === "RUNNING" ? calculateAppRemainingTime(x.runningTime, x.timeLimit) :
          x.state === "PENDING" ? "" : x.timeLimit,
      }));

    }, [cluster]),
  });

  const filteredData = useMemo(() => {
    if (!data) { return undefined; }

    let filtered = data;
    if (query.appJobName) {
      filtered = filtered.filter((x) => (x.jobName.toLowerCase().includes(query.appJobName!.toLowerCase())));
    }

    return filtered;
  }, [data, query.appJobName]);


  const columns: TableColumnsType<NonNullable<typeof data>[number]> = [
    {
      title: t(p("table.jobName")),
      dataIndex: "jobName",
      width: "25%",
      ellipsis: true,
      sorter: (a, b) => a.jobName.localeCompare(b.jobName),
    },
    {
      title: t(p("table.jobId")),
      dataIndex: "jobId",
      width: "8%",
      sorter: (a, b) => compareNumber(a.jobId, b.jobId),
    },
    {
      title: t(p("table.appId")),
      dataIndex: "appId",
      render: (appId: string, record) => record.appName ?? appId,
      sorter: (a, b) => a.appId.localeCompare(b.appId),
    },
    {
      title: t(p("table.submitTime")),
      dataIndex: "submitTime",
      width: "15%",
      render: (_, record) => record.submitTime ? formatDateTime(record.submitTime) : "",
      sorter: (a, b) => (!a.submitTime || !b.submitTime) ? -1 : compareDateTime(a.submitTime, b.submitTime),
    },
    {
      title: t(p("table.state")),
      dataIndex: "state",
      width: "12%",
      render: (_, record) => (
        record.reason ? (
          <Tooltip title={record.reason}>
            <Space>
              {record.state}
              <ExclamationCircleOutlined />
            </Space>
          </Tooltip>
        ) : (
          <span>{record.state}</span>
        )
      ),
      sorter: (a, b) => compareState (a.state, b.state)
        ? compareState (a.state, b.state) :
        compareNumber(a.jobId, b.jobId),
      defaultSortOrder: "descend",
    },
    {
      title: t(p("table.remainingTime")),
      dataIndex: "remainingTime",
      sorter:(a, b) => compareTimeAsSeconds(
        a.state === "PENDING" ?
          a.timeLimit : calculateAppRemainingTime(a.runningTime, a.timeLimit),
        b.state === "PENDING" ?
          b.timeLimit : calculateAppRemainingTime(b.runningTime, b.timeLimit),
      ),
    },
    {
      title: t("button.actionButton"),
      key: "action",
      fixed:"right",
      width: "10%",
      render: (record) => (
        <Space>
          {
            (record.state === "RUNNING") ? (
              <>
                <ConnectTopAppLink
                  session={record}
                  cluster={cluster}
                  refreshToken={connectivityRefreshToken}
                />
                <Popconfirm
                  title={t(p("table.popFinishConfirmTitle"))}
                  onConfirm={async () =>
                    api.cancelJob({ query: {
                      cluster: cluster.id,
                      jobId: record.jobId,
                    } })
                      .then(() => {
                        message.success(t(p("table.popFinishConfirmMessage")));
                        reload();
                      })
                  }
                >
                  <a>{t("button.finishButton")}</a>
                </Popconfirm>
              </>
            ) : undefined
          }
          {
            (record.state === "PENDING" || record.state === "SUSPENDED") ? (
              <Popconfirm
                title={t(p("table.popCancelConfirmTitle"))}
                onConfirm={async () =>
                  api.cancelJob({ query: {
                    cluster: cluster.id,
                    jobId: record.jobId,
                  } })
                    .then(() => {
                      message.success(t(p("table.popCancelConfirmMessage")));
                      reload();
                    })
                }
              >
                <a>{t("button.cancelButton")}</a>
              </Popconfirm>
            ) : undefined
          }
          <a onClick={() => {
            router.push(join("/files", cluster.id, record.dataPath));
          }}
          >
            {t(p("table.linkToPath"))}
          </a>
        </Space>
      ),
    },
  ];

  const [checked, setChecked] = useState(false);
  const [disabled] = useState(false);

  const reloadTable = useCallback(() => {
    reload();
    setConnectivityRefreshToken((f) => !f);
  }, [reload, setConnectivityRefreshToken]);

  const onChange = (e: CheckboxChangeEvent) => {
    setChecked(e.target.checked);
  };

  useEffect(() => {
    if (checked) {
      const interval = setInterval(() => {
        reloadTable();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [reload, checked]);

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { appJobName } = await form.validateFields();
            setQuery({ appJobName: appJobName?.trim() });
          }}
        >
          <Form.Item label={t(p("filterForm.appJobName"))} name="appJobName">
            <Input style={{ minWidth: "160px" }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">{t("button.searchButton")}</Button>
            </Space>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button loading={isLoading} onClick={() => reloadTable()}>{t("button.refreshButton")}</Button>
            </Space>
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={checked}
              disabled={disabled}
              onChange={onChange}
            >
              {t(p("filterForm.autoRefresh"))}
            </Checkbox>
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={onlyNotEnded}
              onChange={(e) => setOnlyNotEnded(e.target.checked)}
            >
              {t(p("filterForm.onlyNotEnded"))}
            </Checkbox>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        tableLayout="fixed"
        dataSource={onlyNotEnded ? filteredData?.filter((x) => x.state !== "ENDED") : filteredData}
        columns={columns}
        rowKey={(record) => record.sessionId}
        loading={!filteredData && isLoading}
        scroll={{ x: filteredData?.length ? 1200 : true }}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
      />
    </div>
  );
};

