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

import { OperationType } from "@scow/lib-operation-log/build/index";
import { formatDateTime, getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, DatePicker, Form, Input, Select, Table } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { getI18nCurrentText, prefix, useI18n, useI18nTranslate, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";
import {
  getOperationDetail,
  getOperationResultTexts,
  getOperationTypeTexts, OperationLog,
  OperationLogQueryType,
  OperationResult, OperationSortBy, OperationSortOrder,
} from "src/models/operationLog";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { User } from "src/stores/UserStore";
import { styled } from "styled-components";

const WordBreakText = styled.div`
  word-wrap: break-word;
  word-break: break-all;`;

interface FilterForm {
  operatorUserId?: string;
  operationType?: string;
  customEventType?: string
  operationTime?: [dayjs.Dayjs, dayjs.Dayjs],
  operationResult?: OperationResult;
  operationDetail?: string; // 这里是将用户、作业ID等视为操作对象；表格中的操作对象是上述操作对象的和
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface Props {
  user: User;
  queryType: OperationLogQueryType;
  accountName?: string
  tenantName?: string;
}

interface Order {
  field: OperationSortBy | undefined;
  order: OperationSortOrder | undefined;
}

const today = dayjs().endOf("day");

const p = prefix("component.others.");
const pCommon = prefix("common.");

export const OperationLogTable: React.FC<Props> = ({ user, queryType, accountName, tenantName }) => {

  const t = useI18nTranslateToString();
  const tArgs = useI18nTranslate();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const OperationResultTexts = getOperationResultTexts(t);
  const OperationTypeTexts = getOperationTypeTexts(t);

  const { message } = App.useApp();

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      operatorUserId: undefined,
      operationType: undefined,
      operationTime: [today.clone().subtract(30, "day"), today],
      operationResult: undefined,
      operationDetail: undefined,
      customEventType: undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  // 定义排序方式
  const [sorter, setSorter] = useState<Order>({ field: undefined, order: undefined });

  const getOperatorUserIds = () => {
    if (queryType === OperationLogQueryType.USER) {
      return [user.identityId];
    }
    const operatorUserId = query.operatorUserId?.trim();
    return operatorUserId ? [operatorUserId] : [];
  };

  const promiseFn = useCallback(async () => {
    return await api.getOperationLogs({
      query: {
        type: queryType,
        operatorUserIds: getOperatorUserIds().join(","),
        operationType: query.operationType as OperationType,
        operationResult: query.operationResult,
        startTime: query.operationTime?.[0].toISOString(),
        endTime: query.operationTime?.[1].toISOString(),
        operationTargetAccountName: accountName,
        operationDetail: query.operationDetail,
        customEventType: query.customEventType,
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
        // 新增排序参数
        sortBy: sorter.field,
        sortOrder: sorter.order,
      },
    });
  }, [query, pageInfo, queryType, accountName, tenantName, sorter]);

  const { data, isLoading } = useAsync({ promiseFn });

  const getCustomEventTypesPromise = useCallback(async () => {
    return await api.getCustomEventTypes({});
  }, []);

  const { data: customEventTypes, isLoading: customEventTypesLoading } = useAsync({
    promiseFn: getCustomEventTypesPromise,
  });

  const operationTypes = useMemo(() => {
    const { customEvent, ...otherTypes } = OperationTypeTexts;
    const standardTypeOptions = Object.keys(otherTypes).map((key) => ({
      label: OperationTypeTexts[key],
      value: key,
    }));

    if (customEventTypesLoading || !customEventTypes) {
      return standardTypeOptions;
    }

    const customTypeOptions = customEventTypes.results.map((t) => ({
      label: getI18nCurrentText(t.name, languageId),
      value: `customEvent-${t.type}`, // 使用特殊格式标识自定义事件类型
    }));

    return [...standardTypeOptions, ...customTypeOptions];
  }, [languageId, customEventTypes, customEventTypesLoading]);



  const getformatData = (results: OperationLog[] | undefined) => {
    if (!results) {
      return [];
    }
    return results.map((data) => {
      return {
        ...data,
        operationType: data.operationEvent?.$case || "unknown",
        operationDetail: getOperationDetail(data.operationEvent, t, tArgs, languageId, publicConfigClusters),
      };
    });
  };

  // 处理表格排序事件
  const handleTableChange = (pagination, _, sorter) => {
    setPageInfo({ page: pagination.current, pageSize: pagination.pageSize });
    setSorter({
      field: sorter.field === "operationLogId" ? "id" : sorter.field,
      order: sorter.order,
    });
  };

  const handleExport = async (columns: string[], encoding: Encoding) => {
    const total = data?.totalCount ?? 0;

    // 获取浏览器时区
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      window.location.href = urlToExport({
        encoding,
        exportApi: "exportOperationLog",
        columns,
        count: total,
        timeZone, // 将浏览器时区作为参数传递到后端
        query: {
          type: queryType,
          operatorUserIds: getOperatorUserIds().join(","),
          operationType: query.operationType,
          customEventType: query.customEventType,
          operationResult: query.operationResult,
          startTime: query.operationTime?.[0].toISOString(),
          endTime: query.operationTime?.[1].toISOString(),
          operationTargetAccountName: accountName,
          operationDetail: query.operationDetail,
          page: pageInfo.page,
          pageSize: pageInfo.pageSize,
          publicConfigClusters: JSON.stringify(publicConfigClusters),
        },
      });
    }

  };

  const exportOptions = useMemo(() => {
    return [
      { label: t(p("operationTime")), value: "operationTime" },
      { label: t(p("operationType")), value: "operationType" },
      { label: t(p("operatorUser")), value: "operatorUserId" },
      { label: t(p("operationDetail")), value: "operationDetail" },
      { label: t(p("operationResult")), value: "operationResult" },
      { label: t(p("operatorIp")), value: "operatorIp" },
    ];
  }, [t]);


  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          form={form}
          layout="inline"
          initialValues={query}
          onFinish={async () => {
            const { operationType, operatorUserId,
              operationResult, operationTime, operationDetail } = await form.validateFields();

            let customEventType: string | undefined;
            let formatOperationType: string | undefined;
            if (operationType?.startsWith("customEvent-")) {
              formatOperationType = "customEvent";
              customEventType = operationType.split("customEvent-")[1];
            } else {
              formatOperationType = operationType;
              customEventType = undefined;
            }

            setQuery({
              operationType: formatOperationType, operatorUserId, operationResult,
              operationTime, operationDetail, customEventType,
            });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <Form.Item label={t(p("operationType"))} name="operationType">
            <Select
              showSearch
              options={
                operationTypes
              }
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item label={t(p("operationResult"))} name="operationResult">
            <Select
              options={
                Object.keys(OperationResultTexts)
                  .filter((key) => key !== OperationResult.UNKNOWN.toString())
                  .map((key) => ({ value: key, label: OperationResultTexts[key] }))}
              allowClear
              style={{ width: 80 }}
            />
          </Form.Item>
          {queryType !== OperationLogQueryType.USER && (
            <Form.Item label={t(p("operatorUserId"))} name="operatorUserId">
              <Input style={{ width: 150 }} />
            </Form.Item>
          )}
          <Form.Item label={t(p("operationDetail"))} name="operationDetail">
            <Input
              placeholder={t(p("keywordsPlaceholder"))}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item label={t(p("operationTime"))} name="operationTime">
            <DatePicker.RangePicker showTime allowClear={false} presets={getDefaultPresets(languageId)} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
          </Form.Item>
          <Form.Item>
            <ExportFileModaLButton
              options={exportOptions}
              onExport={handleExport}
            >
              {t(pCommon("export"))}
            </ExportFileModaLButton>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        dataSource={getformatData(data?.results)}
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: pageInfo.page,
          pageSize: pageInfo.pageSize,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          showSizeChanger: true,
          total: data?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
      >
        <Table.Column<OperationLog>
          dataIndex="operationLogId"
          title="ID"
          sorter={true}
        />
        <Table.Column<OperationLog>
          dataIndex="operationTime"
          title={t(p("operationTime"))}
          render={formatDateTime}
          sorter={true}
        />
        <Table.Column<OperationLog>
          dataIndex="operationType"
          title={t(p("operationType"))}
          render={(operationType, r) => {
            return r.operationEvent.$case === "customEvent"
              ? getI18nCurrentText(r.operationEvent.customEvent.name, languageId)
              : OperationTypeTexts[operationType];
          }
          }
        />
        <Table.Column<OperationLog>
          dataIndex="operatorUserId"
          title={t(p("operatorUser"))}
          render={(_, r) => (`${r.operatorUserName} (ID: ${r.operatorUserId})`)}
          sorter={true}
        />
        <Table.Column
          dataIndex="operationDetail"
          title={t(p("operationDetail"))}
          width="30%"
          render={(operationDetail) => (
            <WordBreakText>{operationDetail}</WordBreakText>
          )}
        />
        <Table.Column<OperationLog>
          dataIndex="operationResult"
          title={t(p("operationResult"))}
          render={(operationResult) => OperationResultTexts[operationResult]}
          sorter={true}
        />
        <Table.Column<OperationLog>
          dataIndex="operatorIp"
          title={t(p("operatorIp"))}
          render={(operatorIp) => (
            <WordBreakText>{operatorIp}</WordBreakText>
          )}
          sorter={true}
        />
      </Table>
    </div>
  );
};
