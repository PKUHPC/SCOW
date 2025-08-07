"use client";

import { Decimal } from "@scow/lib-decimal";
import { Button, Form, Input, InputNumber, Space, Table, TableColumnsType, Tooltip } from "antd";
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
  jobId: number | undefined,
  qubits: number | undefined,
  shots: number | undefined,
  accountName: string | undefined,
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
      qubits: undefined,
      shots: undefined,
      accountName: undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();


  const columns: TableColumnsType<FindTask> = [
    {
      title: t(p("jobId")),
      dataIndex: "jobId",
      width: "50px",
      ...(isDashboard
        ? {}
        : {
          sorter: (a, b) => a.jobId - b.jobId,
        }),
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
      title: "Shots",
      dataIndex: "shots",
      width: "20px",
      ellipsis: true,
    },
    {
      title: "Qubits",
      dataIndex: "qubits",
      width: "20px",
      render: (qubits?: number) => qubits ?? EMPTY_STRING,
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
      title: t(p("qits")),
      dataIndex: "qits",
      width: "60px",
      render: (qits?: Decimal) => qits?.toString() ?? EMPTY_STRING,
    },
    {
      title: t(p("state")),
      dataIndex: "state",
      width: "30px",
      render: (state: string) => (
        <span style={{ color: statusColors[state.toUpperCase()] }}>
          {state.toUpperCase()}</span>
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


  const filteredData = useMemo(() => {
    if (!data) { return []; }

    const result = data.tasks.filter((x) => {
      const dataMatchedJobId = !query.jobId || (Number(x.jobId) === query.jobId);
      const dataMatchedQubits = !query.qubits || (x.qubits === query.qubits);
      const dataMatchedShots = !query.shots || (x.shots === query.shots);
      const dataMatchedAccountName = !query.accountName || (x.account === query.accountName.trim());
      return dataMatchedJobId && dataMatchedQubits && dataMatchedShots && dataMatchedAccountName;
    }).map((x) => {
      const processedX = { ...x };

      // 如果 device 字段存在且包含 "?o=" 后缀，则去掉后缀
      if (processedX.device.includes("?o=")) {
        processedX.device = processedX.device.split("?o=")[0];
      }

      return {
        ...processedX,
        submitTime: formatDateTime(processedX.submitTime),
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
              <Form.Item label={t(p("account"))} name="accountName">
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
