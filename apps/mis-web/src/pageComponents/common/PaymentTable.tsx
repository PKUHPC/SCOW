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

import { formatDateTime, getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { useDidUpdateEffect } from "@scow/lib-web/build/utils/hooks";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, DatePicker, Form, Input, Table } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { AccountSelector } from "src/pageComponents/finance/AccountSelector";
import { TenantSelector } from "src/pageComponents/tenant/TenantSelector";

export enum SearchType {
    account = "account",
    tenant = "tenant",
    // 仅搜索自己账户
    selfAccount = "selfAccount",
    // 仅搜索自己租户
    selfTenant = "selfTenant",
}

interface Props {
  // 账户充值记录专用项
  accountName?: string [];
  // 搜索类型, self前缀表示只搜索用户自身的账户或租户
  searchType: SearchType;
}

// 表格展示的数据
interface TableProps {
  time: string;
  amount: number;
  comment: string;
  type: string;
  index: number;
  ipAddress: string;
  operatorId: string;
  tenantName?: string;
  accountName?: string;
}

interface FilterForm {
  // 账户名或租户名
  name?: string [];
  time: [dayjs.Dayjs, dayjs.Dayjs],
  type?: string;
}

const today = dayjs().endOf("day");

const p = prefix("pageComp.commonComponent.paymentTable.");
const pCommon = prefix("common.");

export const PaymentTable: React.FC<Props> = ({ accountName, searchType }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FilterForm>();

  const [selectedNames, setSelectedNames] = useState<string [] | undefined>(accountName);

  const [query, setQuery] = useState<{
    name: string[] | undefined,
    time: [ dayjs.Dayjs, dayjs.Dayjs ]
    type: string[]
    }>(() => ({
      // name作为账户名时可能为 undefined 、长度不定的的数组
      // name作为租户名时可能为 undefined 、长度为1的的数组
      name: accountName,
      time: [today.subtract(1, "year"), today],
      type: [],
    }));

  const { message } = App.useApp();

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const param = {
        startTime: query.time[0].clone().startOf("day").toISOString(),
        endTime: query.time[1].clone().endOf("day").toISOString(),
        type:query.type,
      };
      // 平台管理下的租户充值记录
      if (searchType === SearchType.tenant) {
        return api.getTenantPayments({ query: { ...param, tenantName:query.name ? query.name[0] : undefined } });

      } else {
        return api.getPayments({ query: { ...param, accountName: query.name, searchType } });
      }
    }, [query]),
  });

  useDidUpdateEffect(() => {
    setQuery((q) => ({ ...q, name: accountName }));
    setSelectedNames(accountName);
  }, [accountName]);

  const handleExport = async (columns: string[]) => {

    const total = data?.results?.length ?? 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {

      window.location.href = urlToExport({
        exportApi: "exportPayRecord",
        columns,
        count: total,
        query: {
          startTime: query.time[0].clone().startOf("day").toISOString(),
          endTime: query.time[1].clone().endOf("day").toISOString(),
          targetName: query.name,
          searchType: searchType,
          type:query.type,
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    const common = [
      { label: t(p("paymentDate")), value: "time" },
      { label: t(p("paymentAmount")), value: "amount" },
      { label: t(pCommon("type")), value: "type" },

    ];
    const account = searchType === SearchType.account ? [
      { label: t(pCommon("account")), value: "accountName" },
    ] : [];
    const tenant = searchType === SearchType.tenant ? [
      { label: t(pCommon("tenant")), value: "tenantName" },
    ] : [];
    const ipAndOperator = searchType !== SearchType.selfAccount ? [
      { label: t(p("ipAddress")),
        value: "ipAddress" },
      {
        label:t(p("operatorId")),
        value: "operatorId",
      },
    ] : [];
    const comment = [{ label: t(pCommon("comment")), value: "comment" }];
    return [...account, ...tenant, ...common, ...ipAndOperator, ...comment];
  }, [searchType, t]);


  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { name, time, type } = await form.validateFields();
            setQuery({ name: selectedNames ?? name, time, type:type ? type.split(/,|，/) : []});
          }}
        >
          { (searchType === SearchType.account || searchType === SearchType.tenant) ? (
            <Form.Item
              label={searchType === SearchType.account ?
                t(pCommon("account")) : t(pCommon("tenant"))}
              name="name"
            >
              {searchType === SearchType.account ? (
                <AccountSelector
                  onChange={(item) => {
                    setSelectedNames(item);
                  }}
                  placeholder={t(pCommon("selectAccount"))}
                />
              ) : (
                <TenantSelector
                  onChange={(item) => {
                    setSelectedNames([item]);

                  }}
                  placeholder={t(pCommon("selectTenant"))}
                />
              )}
            </Form.Item>
          )
            : undefined}
          <Form.Item label={t(pCommon("time"))} name="time">
            <DatePicker.RangePicker allowClear={false} presets={getDefaultPresets(languageId)} />
          </Form.Item>
          <Form.Item label={t("common.type")} name="type">
            <Input style={{ width: 180 }} placeholder={t(p("searchTypePlaceholder"))} />
          </Form.Item>
          <Form.Item label={t(p("total"))}>
            <strong>
              {data ? data.results.length : 0}
            </strong>
          </Form.Item>
          <Form.Item label={t(p("sum"))}>
            <strong>
              {data ? data.total.toFixed(3) : 0}
            </strong>
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
        tableLayout="fixed"
        dataSource={data?.results as Array<TableProps>}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
      >
        {
          searchType === SearchType.account
            ? <Table.Column dataIndex="accountName" title={t(pCommon("account"))} />
            : undefined
        }
        {
          searchType === SearchType.tenant
            ? <Table.Column dataIndex="tenantName" title={t(pCommon("tenant"))} />
            : undefined
        }
        <Table.Column dataIndex="time" title={t(p("paymentDate"))} width="13.5%" render={(v) => formatDateTime(v)} />
        <Table.Column dataIndex="amount" title={t(p("paymentAmount"))} width="10%" render={(v) => v.toFixed(3)} />
        <Table.Column
          dataIndex="type"
          title={t(pCommon("type"))}
          width="15%"
        />
        {
          searchType !== SearchType.selfAccount ? (
            <>
              <Table.Column dataIndex="ipAddress" title={t(p("ipAddress"))} />
              <Table.Column dataIndex="operatorId" title={t(p("operatorId"))} />
            </>
          ) : undefined
        }
        <Table.Column
          dataIndex="comment"
          title={t(pCommon("comment"))}
          width="20%"
        />
      </Table>
    </div>

  );
};
