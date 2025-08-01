import {
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber, compareTimeAsSeconds } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, Checkbox, Form, Input, Space, Table, Tooltip } from "antd";
import { CheckboxChangeEvent } from "antd/es/checkbox";
import type { ColumnType } from "antd/es/table";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { usePublicConfig } from "src/context/PublicConfigContext";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { calculateAppRemainingTime, compareState } from "src/models/job";
import { ConnectTopAppLink } from "src/pageComponents/jupyter/ConnectToAppLink";
import { trpc } from "src/utils/trpc";

interface Props {
  isDashboard?: boolean;
}

interface FilterForm {
  appJobName: string | undefined;
}

interface AppSessionTableRow {
  sessionId: string;
  jobName: string;
  jobId: number;
  submitTime?: string;
  appId: string;
  appName?: string;
  state: string;
  dataPath: string;
  runningTime: string;
  timeLimit: string;
  reason?: string;
  host?: string;
  port?: number;
  user?: string;
  proxyServer?: string;
  appType?: string;
  connectPath?: string;
  remainingTime: string;
}

const p = prefix("pageComp.appSessionTable.");

export const AppSessionsTable: React.FC<Props> = ({ isDashboard }) => {

  const [query, setQuery] = useState<FilterForm>(() => {
    return { appJobName: undefined };
  });
  const [form] = Form.useForm<FilterForm>();

  const t = useI18nTranslateToString();

  const { data, refetch, isLoading } = trpc.jobs.listAppSessions.useQuery({});

  // 获取Quantum配置
  const quantumConfigQuery = trpc.jobs.getQuantumConfig.useQuery();

  // 提取cluster值
  const cluster = useMemo(() =>
    quantumConfigQuery.data?.cluster || undefined
  , [quantumConfigQuery.data]);

  const appId = useMemo(() =>
    quantumConfigQuery.data?.appId || undefined
  , [quantumConfigQuery.data]);

  const [onlyNotEnded, setOnlyNotEnded] = useState(false);

  const filteredData = useMemo(() => {
    if (!data) { return []; }

    const result = data.sessions.filter((x) => {
      if (query.appJobName) {
        const jobName = x.jobName ? x.jobName : x.sessionId;
        return jobName.toLowerCase().includes(query.appJobName.toLowerCase());
      }
      return true;
    }).map((x) =>
      ({
        ...x,
        jobName: x.jobName ? x.jobName : x.sessionId,
        remainingTime: x.state === "RUNNING" ? calculateAppRemainingTime(x.runningTime, x.timeLimit) :
          x.state === "PENDING" ? "" : x.timeLimit,
      }),
    ).sort((a, b) => (!a.submitTime || !b.submitTime) ? -1 : compareDateTime(b.submitTime, a.submitTime));

    return isDashboard ? result.slice(0, 10) : result;

  }, [data, query]);

  // 1. 获取公共配置数据
  const publicConfig = usePublicConfig();

  // 5. 构建动态URL
  const portalUrl = publicConfig.publicConfig.portalUrl;

  const appCreateUrl = `apps/${cluster}/create/${appId}`;

  const columns: ColumnType<AppSessionTableRow>[] = [
    {
      title: t(p("table.jobName")),
      dataIndex: "jobName",
      width: "25%",
      ellipsis: true,
      ...(isDashboard
        ? {}
        : {
          sorter: (a: AppSessionTableRow, b: AppSessionTableRow) => a.jobName.localeCompare(b.jobName),
        }),
    },
    {
      title: t(p("table.jobId")),
      dataIndex: "jobId",
      width: "8%",
      ...(isDashboard
        ? {}
        : {
          sorter: (a: AppSessionTableRow, b: AppSessionTableRow) => compareNumber(a.jobId, b.jobId),
        }),
    },
    {
      title: t(p("table.appId")),
      dataIndex: "appId",
      render: (_: any, record: AppSessionTableRow) => record.appName ?? record.appId,
      ...(isDashboard
        ? {}
        : {
          sorter: (a: AppSessionTableRow, b: AppSessionTableRow) => a.appId.localeCompare(b.appId),
        }),
    },
    {
      title: t(p("table.submitTime")),
      dataIndex: "submitTime",
      width: "15%",
      render: (_, record) => record.submitTime ? formatDateTime(record.submitTime) : "",
      ...(isDashboard
        ? {}
        : {
          sorter: (a, b) => (!a.submitTime || !b.submitTime) ? -1 : compareDateTime(a.submitTime, b.submitTime),
        }),
    },
    {
      title: t(p("table.state")),
      dataIndex: "state",
      width: "12%",
      render: (_: any, record: AppSessionTableRow) => (
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
      ...(isDashboard
        ? {}
        : {
          sorter: (a: AppSessionTableRow, b: AppSessionTableRow) =>
            compareState(a.state, b.state) || compareNumber(a.jobId, b.jobId),
        }),
    },
    {
      title: t(p("table.remainingTime")),
      dataIndex: "remainingTime",
      ...(isDashboard
        ? {}
        : {
          sorter: (a: AppSessionTableRow, b: AppSessionTableRow) => compareTimeAsSeconds(
            a.state === "PENDING"
              ? a.timeLimit
              : calculateAppRemainingTime(a.runningTime, a.timeLimit),
            b.state === "PENDING"
              ? b.timeLimit
              : calculateAppRemainingTime(b.runningTime, b.timeLimit),
          ),
        }),

    },
  ];

  if (!isDashboard) {
    columns.push({
      title: t("button.actionButton"),
      key: "action",
      fixed: "right",
      width: "10%",
      render: (record: AppSessionTableRow) => (
        <Space>
          {
            (record.state === "RUNNING") && (
              <>
                {cluster && (
                  <ConnectTopAppLink
                    session={record}
                    cluster={cluster}
                  />
                )}
                {/* <Popconfirm
                title={t(p("table.popFinishConfirmTitle"))}
                  onConfirm={async () =>
                    api.cancelJob({ query: {
                      cluster: cluster.id,
                      jobId: record.jobId,
                    } })
                      .then(() => {
                        message.success(t(p("table.popFinishConfirmMessage")));
                        refetch();
                      })
                  }
              >
                <a>{t("button.finishButton")}</a>
                </Popconfirm> */}
              </>
            )
          }
          {/* {
            (record.state === "PENDING" || record.state === "SUSPENDED") ? (
              <Popconfirm
                title={t(p("table.popFinishConfirmTitle"))}
                onConfirm={async () =>
                  message.success(t(p("table.popCancelConfirmMessage")))
                }
              >
                <a>{t("button.cancelButton")}</a>
              </Popconfirm>
            ) : undefined
          } */}
          {/* <a onClick={() => {
            router.push(join("/files"));
          }}
          >
            {t(p("table.linkToPath"))} 进入目录暂时还未实现
          </a> */}
        </Space>
      ),
    });
  }

  const [checked, setChecked] = useState(false);
  const [disabled] = useState(false);

  const reloadTable = useCallback(() => {
    refetch();
  }, [refetch]);

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
  }, [refetch, checked]);

  return (
    <div>
      {
        !isDashboard && (
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
              <Form.Item style={{ marginLeft: "auto" }}>
                <Button
                  type="primary" // Set type to primary for the desired style
                  onClick={() => window.open(join(portalUrl, appCreateUrl), "_blank")} // Handle navigation
                  disabled={!cluster || !appId}
                >
                  {t("page.jupyter.create")} jupyter
                </Button>
              </Form.Item>
            </Form>
          </FilterFormContainer>
        )
      }
      <Table
        tableLayout="fixed"
        dataSource={onlyNotEnded ? filteredData?.filter((x) => x.state !== "ENDED") : filteredData}
        columns={columns}
        rowKey={(record) => record.sessionId}
        loading={!filteredData && isLoading}
        scroll={{ x: filteredData?.length ? 1200 : true }}
        pagination={isDashboard ? false : { defaultPageSize: DEFAULT_PAGE_SIZE, showSizeChanger: true }}
      />
    </div>
  );
};

