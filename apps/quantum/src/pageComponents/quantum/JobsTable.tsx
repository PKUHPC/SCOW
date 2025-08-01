"use client";

import { Button, Form, Input, InputNumber, Space, Table, TableColumnsType } from "antd";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { EMPTY_STRING } from "src/models/common";
import { FindTask } from "src/models/task";
import { formatDateTime, formatTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

interface Props {
  isDashboard?: boolean;
}

interface FilterForm {
  jobId: number | undefined,
  tags: string | undefined,
  qubits: number | undefined,
  shots: number | undefined,
}

export const JobsTable: React.FC<Props> = ({ isDashboard }) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.quantum.jobsTable.");

  const { data, refetch, isLoading, isFetching } = trpc.backend.task.findTask.useQuery({ accountName: "_" });

  const reloadTable = useCallback(() => {
    refetch();
  }, [refetch]);


  useEffect(() => {
    const interval = setInterval(() => {
      reloadTable();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      jobId: undefined,
      tags: undefined,
      qubits: undefined,
      shots: undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();


  const columns: TableColumnsType<FindTask> = [
    {
      title: t(p("jobId")),
      dataIndex: "jobId",
      width: "60px",
      ...(isDashboard
        ? {}
        : {
          sorter: (a, b) => a.jobId - b.jobId,
        }),
    },
    {
      title: t(p("jobName")),
      dataIndex: "name",
      width: "80px",
      render: (name?: string) => name ?? EMPTY_STRING,
      ellipsis: true,
    },
    {
      title: t(p("tags")),
      dataIndex: "tags",
      width: "80px",
      render: (tags?: string) => tags ?? EMPTY_STRING,
      ellipsis: true,
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
      width: "60px",
      ellipsis: true,
    },
    {
      title: "Shots",
      dataIndex: "shots",
      width: "20px",
      ellipsis: true,
    },
    {
      title: "Qubits",
      dataIndex: "qubits",
      width: "30px",
      render: (qubits?: number) => qubits ?? EMPTY_STRING,
    },
    {
      title: t(p("priority")),
      dataIndex: "prior",
      width: "60px",
      render: (prior?: number) => prior ?? EMPTY_STRING,
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
      render: (duration: number) => duration ? formatTime(duration) : EMPTY_STRING,
    },
    {
      title: t(p("state")),
      dataIndex: "state",
      width: "30px",
    },
    ...(isDashboard
      ? []
      : [
        {
          title: t(p("action")),
          width: "30px",
          render: (r: FindTask) => (
            <Link href={{ pathname: `/quantum/${r.id}/detail` }}>
              {t(p("detail"))}
            </Link>
          ),
        },
      ]),
  ];


  const filteredData = useMemo(() => {
    if (!data) { return []; }

    const result = data.tasks.filter((x) => {
      const dataMatchedJobId = !query.jobId || (Number(x.jobId) === query.jobId);
      const dataMatchedTags = !query.tags || (x.tags === query.tags);
      const dataMatchedQubits = !query.qubits || (x.qubits === query.qubits);
      const dataMatchedShots = !query.shots || (x.shots === query.shots);
      return dataMatchedJobId && dataMatchedTags && dataMatchedQubits && dataMatchedShots;
    }).map((x) => {
      const processedX = { ...x };

      // 如果 device 字段存在且包含 "?o=" 后缀，则去掉后缀
      if (processedX.device.includes("?o=")) {
        processedX.device = processedX.device.split("?o=")[0];
      }

      return {
        ...processedX,
        submitTime: formatDateTime(processedX.submitTime),
        account: EMPTY_STRING, // 后续必不为空
      };
    });

    return isDashboard ? result.slice(0, 10) : result;

  }, [data, query]);

  return (
    <>
      {
        !isDashboard && (
          <FilterFormContainer>
            <Form<FilterForm>
              layout="inline"
              form={form}
              initialValues={query}
              onFinish={async () => {
                setQuery({
                  ...(await form.validateFields()),
                });
              }}
            >
              <Form.Item label={t(p("jobId"))} name="jobId">
                <InputNumber style={{ minWidth: "160px" }} />
              </Form.Item>
              <Form.Item label={t(p("tags"))} name="tags">
                <Input style={{ minWidth: "160px" }} />
              </Form.Item>
              <Form.Item label="Qubits" name="qubits">
                <InputNumber style={{ minWidth: "160px" }} />
              </Form.Item>
              <Form.Item label="Shots" name="shots">
                <InputNumber style={{ minWidth: "160px" }} />
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
            </Form>
          </FilterFormContainer>
        )
      }
      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        columns={columns}
        rowKey={(record) => record.jobId}
        loading={isLoading || isFetching}
        scroll={{ x: "max-content" }}
        pagination={isDashboard ? false : { defaultPageSize: 50, showSizeChanger: true }}
      />
    </>
  );
};
