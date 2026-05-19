"use client";

import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Button, Form, InputNumber, Space, Table, TableColumnsType, Tooltip } from "antd";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DetailIcon } from "src/icons/headerIcons/headerIcons";
import { EMPTY_STRING } from "src/models/common";
import { statusColors } from "src/models/job";
import { FindTask } from "src/models/task";
import { formatDateTime, formatTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

interface Props {
  isDashboard?: boolean;
}

interface FilterForm {
  jobId: number | undefined;
  qubits: number | undefined;
  shots: number | undefined;
  accountName: string | undefined;
}

interface QueryState extends FilterForm {
  page: number;
  pageSize: number;
}

export const JobsTable: React.FC<Props> = ({ isDashboard }) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.quantum.jobsTable.");

  const [query, setQuery] = useState<QueryState>({
    jobId: undefined,
    qubits: undefined,
    shots: undefined,
    accountName: undefined,
    page: 1,
    pageSize: 50,
  });

  const { data, refetch, isLoading, isFetching } = trpc.backend.task.findTask.useQuery(
    {
      accountName: query.accountName?.trim() && query.accountName.trim() !== "" ? query.accountName.trim() : "_",
      page: isDashboard ? 1 : query.page,
      pageSize: isDashboard ? 10 : query.pageSize,
      id: query.jobId ?? undefined,
      qubits: query.qubits ?? undefined,
      shots: query.shots ?? undefined,
      querySelf: true,
    },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  const reloadTable = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const [form] = Form.useForm<FilterForm>();

  const columns: TableColumnsType<FindTask> = [
    {
      title: t(p("jobId")),
      dataIndex: "jobId",
      width: "50px",
    },
    {
      title: t(p("account")),
      dataIndex: "account",
      width: "60px",
      ellipsis: true,
    },
    {
      title: t(p("device")),
      dataIndex: "device",
      width: "50px",
      ellipsis: true,
    },
    {
      title: "Qubits",
      dataIndex: "qubits",
      width: "20px",
      render: (qubits?: number) => qubits ?? EMPTY_STRING,
    },
    {
      title: "Shots",
      dataIndex: "shots",
      width: "20px",
      ellipsis: true,
    },
    {
      title: t(p("submitTime")),
      dataIndex: "submitTime",
      width: "60px",
    },
    {
      title: t(p("lastUpdated")),
      dataIndex: "lastSyncTime",
      width: "60px",
      render: (lastSyncTime: Date) => formatDateTime(lastSyncTime.toLocaleString()),
    },
    {
      title: t(p("runDur")),
      dataIndex: "duration",
      width: "60px",
      render: (duration: number) => (duration ? formatTime(duration) : EMPTY_STRING),
    },
    {
      title: t(p("qits")),
      dataIndex: "qits",
      width: "60px",
      render: (qits?: number) => qits ?? EMPTY_STRING,
    },
    {
      title: t(p("billing")),
      dataIndex: "amount",
      width: "60px",
      render: (amount?: number) => (amount !== undefined ? amount.toFixed(2) : EMPTY_STRING),
    },
    {
      title: t(p("state")),
      dataIndex: "state",
      width: "30px",
      render: (state: string) => (
        <span style={{ color: statusColors[state.toUpperCase()] }}>{state.toUpperCase()}</span>
      ),
    },
    ...(isDashboard
      ? []
      : [
          {
            title: t(p("action")),
            width: "30px",
            render: (r: FindTask) => (
              <Link href={{ pathname: `/quantum/${r.id}/detail` }}>
                <Tooltip title={t(p("detail"))}>
                  <DetailIcon />
                </Tooltip>
              </Link>
            ),
          },
        ]),
  ];

  const jobsData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.tasks.map((x) => {
      const processedX = { ...x };
      if (processedX.device.includes("?o=")) {
        processedX.device = processedX.device.split("?o=")[0];
      }
      return {
        ...processedX,
        submitTime: formatDateTime(processedX.submitTime),
      };
    });
  }, [data]);

  return (
    <>
      {!isDashboard && (
        <FilterFormContainer>
          <Form<FilterForm>
            layout="inline"
            form={form}
            initialValues={{
              jobId: query.jobId,
              qubits: query.qubits,
              shots: query.shots,
              accountName: query.accountName,
            }}
            onFinish={async () => {
              const values = await form.validateFields();
              setQuery({
                ...values,
                page: 1,
                pageSize: query.pageSize,
              });
            }}
          >
            <Form.Item label={t(p("jobId"))} name="jobId">
              <InputNumber style={{ minWidth: "160px" }} min={1} />
            </Form.Item>
            <Form.Item label={t(p("account"))} name="accountName">
              <Input style={{ minWidth: "160px" }} />
            </Form.Item>
            <Form.Item label="Qubits" name="qubits">
              <InputNumber style={{ minWidth: "160px" }} min={1} />
            </Form.Item>
            <Form.Item label="Shots" name="shots">
              <InputNumber style={{ minWidth: "160px" }} min={1} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {t("button.searchButton")}
                </Button>
              </Space>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button loading={isLoading} onClick={() => reloadTable()}>
                  {t("button.refreshButton")}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </FilterFormContainer>
      )}
      <Table
        tableLayout="fixed"
        dataSource={jobsData}
        columns={columns}
        rowKey={(record) => record.jobId}
        loading={isLoading || isFetching}
        scroll={{ x: "max-content" }}
        pagination={
          isDashboard
            ? false
            : {
                total: data?.totalCount ?? 0,
                current: query.page,
                pageSize: query.pageSize,
                showSizeChanger: true,
                onChange: (page, pageSize) => {
                  setQuery({
                    ...query,
                    page,
                    pageSize,
                  });
                },
              }
        }
      />
    </>
  );
};
