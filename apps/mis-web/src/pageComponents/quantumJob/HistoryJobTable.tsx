import { HttpError } from "@ddadaal/next-typed-api-routes-runtime";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { Static } from "@sinclair/typebox";
import { App, Button, Form, InputNumber, Space, Table } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { JobSortOrder, statusColors } from "src/models/job";
import { JobSortBy } from "src/models/quantumJob";
import type { GetQuantumJobInfoSchema } from "src/pages/api/quantum/jobInfo";

interface FilterForm {
  jobId?: number;
  qubits?: number;
  shots?: number;
  accountName?: string;
  userId?: string;
}

interface Props {
  userId?: string;
  accountName?: string;
  showUser: boolean;
  showAccount: boolean;
  filterAccountName?: boolean;
  filterUserId?: boolean;
}

interface Sorter {
  field: JobSortBy | undefined,
  order: JobSortOrder | undefined,
}

const p = prefix("pageComp.quantumJob.historyJobTable.");
const pCommon = prefix("common.");
const EMPTY_STRING = "-";

export const QuantumJobTable: React.FC<Props> = ({
  accountName, filterAccountName = true, filterUserId = true,
  showAccount, showUser, userId,
}) => {
  const t = useI18nTranslateToString();
  const { message } = App.useApp();

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [query, setQuery] = useState<FilterForm>({
    accountName,
    userId,
  });
  const [sorter, setSorter] = useState<Sorter>({ field: undefined, order: undefined });

  useEffect(() => {
    const newQuery: FilterForm = {
      accountName,
      userId,
    };
    setQuery(newQuery);
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });

    form.resetFields();
    form.setFieldsValue(newQuery);

  }, [accountName, userId, filterAccountName, filterUserId, form]);

  const promiseFn = useCallback(async () => {
    return await api.getQuantumJobInfo({
      query: {
        sortBy: sorter.field,
        sortOrder: sorter.order,
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
        ...query,
        accountName: query.accountName?.trim(),
        userId: query.userId?.trim(),
      },
    }).catch((e: HttpError) => {
      if (e.status === 403) {
        message.error(t(p("noAuth")));
        return undefined;
      } else {
        throw e;
      }
    });
  }, [pageInfo, query, sorter]);

  const { data, isLoading } = useAsync({ promiseFn });

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          onFinish={async (values) => {
            const finalValues = {
              ...values,
              accountName: filterAccountName ? values.accountName : accountName,
              userId: filterUserId ? values.userId : userId,
            };
            setQuery(finalValues);
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <Form.Item label={t(pCommon("clusterWorkId"))} name="jobId">
            <InputNumber style={{ minWidth: "120px" }} min={1} />
          </Form.Item>
          {
            filterAccountName && (
              <Form.Item label={t(pCommon("account"))} name="accountName">
                <Input style={{ minWidth: "120px" }} />
              </Form.Item>
            )}
          {
            filterUserId && (
              <Form.Item label={t(pCommon("userId"))} name="userId">
                <Input style={{ minWidth: "120px" }} />
              </Form.Item>
            )}
          <Form.Item label="Qubits" name="qubits">
            <InputNumber style={{ minWidth: "120px" }} min={1} />
          </Form.Item>
          <Form.Item label="Shots" name="shots">
            <InputNumber style={{ minWidth: "120px" }} min={1} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>

      <JobInfoTable
        data={data}
        isLoading={isLoading}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        setSorter={setSorter}
        showAccount={showAccount}
        showUser={showUser}
      />
    </div>
  );
};

interface JobInfoTableProps {
  data: Static<typeof GetQuantumJobInfoSchema["responses"]["200"]> | undefined;
  pageInfo: { page: number, pageSize: number };
  setPageInfo?: (info: { page: number, pageSize: number }) => void;
  isLoading: boolean;
  setSorter: (sorter: Sorter) => void;
  showAccount: boolean;
  showUser: boolean;
}

export const JobInfoTable: React.FC<JobInfoTableProps> = ({
  data, pageInfo, setPageInfo, setSorter, isLoading,
  showAccount, showUser,
}) => {
  const t = useI18nTranslateToString();
  const handleTableChange = (pagination, filters, sorter) => {
    setSorter({
      field: sorter.field,
      order: sorter.order,
    });
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = milliseconds / 1000;

    // 保留一位小数
    const formattedSeconds = seconds.toFixed(1);

    return `${formattedSeconds}s`;
  };

  const jobsData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.jobs.map((x) => {
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
      <Table
        onChange={handleTableChange}
        rowKey={(i) => i.jobId}
        dataSource={jobsData}
        loading={isLoading}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
        tableLayout="fixed"
        scroll={{ x: data?.jobs?.length ? 1450 : true }}
      >
        <Table.Column<JobInfo>
          dataIndex="jobId"
          width="30px"
          title={t(pCommon("clusterWorkId"))}
          sorter={true}
        />
        {
          showAccount ? (
            <Table.Column<JobInfo>
              dataIndex="account"
              width="50px"
              ellipsis
              title={t(pCommon("account"))}
              sorter={true}
            />
          ) : undefined
        }
        {
          showUser ? (
            <Table.Column<JobInfo>
              dataIndex="user"
              width="50px"
              ellipsis
              title={t(pCommon("userId"))}
              sorter={true}
            />
          ) : undefined
        }
        <Table.Column<JobInfo>
          title={t(p("device"))}
          dataIndex="device"
          width="30px"
          sorter={true}
          ellipsis
        />
        <Table.Column<JobInfo>
          title="Qubits"
          dataIndex="qubits"
          width="30px"
          sorter={true}
          render={(qubits) => qubits ?? EMPTY_STRING}
        />
        <Table.Column<JobInfo>
          title="Shots"
          dataIndex="shots"
          width="30px"
          sorter={true}
        />
        <Table.Column
          dataIndex="submitTime"
          width="40px"
          title={t(pCommon("timeSubmit"))}
          render={(time: string) => formatDateTime(time)}
          sorter={true}
        />
        <Table.Column<JobInfo>
          dataIndex="lastSyncTime"
          width="40px"
          title={t(pCommon("lastUpdated"))}
          render={(time: string) => formatDateTime(time)}
          sorter={true}
        />
        <Table.Column
          title={t(p("runDur"))}
          dataIndex="duration"
          width="30px"
          // sorter={true}
          render={(duration: number) => (duration ? formatTime(duration) : EMPTY_STRING)}
        />
        <Table.Column
          title={t(p("qits"))}
          dataIndex="qits"
          width="30px"
          sorter={true}
        />
        <Table.Column
          title={t(p("billing"))}
          dataIndex="amount"
          width="30px"
          render={(amount?: string) =>
            amount ? parseFloat(amount).toFixed(2) : EMPTY_STRING
          }
          sorter={true}
        />
        <Table.Column
          title={t(p("state"))}
          dataIndex="state"
          width="40px"
          sorter={true}
          render={(state: string) => (
            <span style={{ color: statusColors[state.toUpperCase()] }}>
              {state.toUpperCase()}
            </span>
          )}
        />
      </Table>
    </>
  );
};
