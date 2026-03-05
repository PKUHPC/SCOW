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
import { Encoding } from "src/models/exportFile";
import { PaymentSortBy, PaymentSortOrder } from "src/models/payment";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { AccountMultiSelector } from "src/pageComponents/finance/AccountMultiSelector";
import { TenantSelector } from "src/pageComponents/tenant/TenantSelector";
import { moneyNumberToString } from "src/utils/money";

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
  accountName?: string;
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
  operatorName: string;
  tenantName?: string;
  accountName?: string;
  ownerId?: string;
  ownerName?: string;
}

interface FilterForm {
  // 账户名或租户名
  name?: string;
  names?: string[];
  time: [dayjs.Dayjs, dayjs.Dayjs],
  type?: string;
  operatorId?: string,
  ownerIdOrName?: string;
  operatorIdOrName?: string,
}

interface Sorter {
  field: PaymentSortBy | undefined;
  order: PaymentSortOrder | undefined;
}

const today = dayjs().endOf("day");

const p = prefix("pageComp.commonComponent.paymentTable.");
const pCommon = prefix("common.");

export const PaymentTable: React.FC<Props> = ({ accountName, searchType }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FilterForm>();

  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [selectedNames, setSelectedNames] = useState<string[] | undefined>([]);

  const [query, setQuery] = useState<{
    accountName: string | undefined,
    names: string[] | undefined,
    time: [dayjs.Dayjs, dayjs.Dayjs],
    types: string[],
    operatorIdOrName: string | undefined,
    ownerIdOrName: string | undefined,
  }>(() => ({
    // 账户名
    accountName: accountName,
    // 租户名
    names: [],
    time: [today.subtract(1, "year"), today],
    types: [],
    operatorIdOrName: "",
    ownerIdOrName: "",
  }));

  const { message } = App.useApp();

  // 定义排序状态
  const [sorter, setSorter] = useState<Sorter>({ field: undefined, order: undefined });

  const handleTableChange = (pagination, _, sorter) => {
    setPageInfo({ page: pagination.current, pageSize: pagination.pageSize });
    setSorter({
      field: sorter.field,
      order: sorter.order,
    });
  };

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const param = {
        startTime: query.time[0].clone().startOf("day").toISOString(),
        endTime: query.time[1].clone().endOf("day").toISOString(),
        types: query.types,
        operatorIdOrName: query.operatorIdOrName,
        ownerIdOrName: query.ownerIdOrName,
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
        sortBy: sorter.field,
        sortOrder: sorter.order,
      };

      // 平台管理下的租户充值记录
      if (searchType === SearchType.tenant) {
        return api.getTenantPayments({ query: { ...param, tenantName: query.names ? query.names[0] : undefined } });

      } else {
        return api.getPayments({ query: { ...param, accountNames: query.names, searchType } });
      }
    }, [query, pageInfo]),
  });

  useDidUpdateEffect(() => {
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
    setQuery((q) => ({ ...q, accountName: accountName }));
  }, [accountName]);

  const handleExport = async (encoding: Encoding, columns: string[]) => {

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const total = data?.results?.length ?? 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {

      window.location.href = urlToExport({
        encoding,
        exportApi: "exportPayRecord",
        columns,
        count: total,
        timeZone:timeZone,
        query: {
          startTime: query.time[0].clone().startOf("day").toISOString(),
          endTime: query.time[1].clone().endOf("day").toISOString(),
          targetNames: query.names,
          searchType: searchType,
          types: query.types,
          operatorIdOrName: query.operatorIdOrName,
          ownerIdOrName: query.ownerIdOrName,
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    const common = [
      { label: t(p("paymentTime")), value: "time" },
      { label: t(p("topUpAmount")), value: "amount" },
      { label: t(pCommon("type")), value: "type" },

    ];
    const account = searchType === SearchType.account ? [
      { label: t(pCommon("account")), value: "accountName" },
      { label: t(p("accountHolder")), value: "ownerId" },
    ] : [];
    const tenant = searchType === SearchType.tenant ? [
      { label: t(pCommon("tenant")), value: "tenantName" },
    ] : [];
    const ipAndOperator = searchType !== SearchType.selfAccount ? [
      {
        label: t(p("ipAddress")),
        value: "ipAddress",
      },
      {
        label: t(p("operator")),
        value: "operatorIdAndName",
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
            const { name, time, type, operatorIdOrName, ownerIdOrName } = await form.validateFields();
            let trimmedTypes: string[];
            if (Array.isArray(type) && type.length === 0) {
              trimmedTypes = [];
            } else {
              trimmedTypes = type ? type.split(/,|，/).map((item) => item.trim()) : [];
            }
            setQuery({
              accountName: accountName ?? name,
              names: selectedNames,
              time,
              types: trimmedTypes,
              operatorIdOrName,
              ownerIdOrName,
            });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          {(searchType === SearchType.account || searchType === SearchType.tenant) ? (

            <>
              <Form.Item
                label={searchType === SearchType.account ?
                  t(pCommon("account")) : t(pCommon("tenant"))}
                name="name"
              >
                {searchType === SearchType.account ? (
                  <AccountMultiSelector
                    value={selectedNames ?? []}
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
            </>
          )
            : undefined }
          {
            searchType === SearchType.account ? (
              <Form.Item label={t(p("accountHolder"))} name="ownerIdOrName">
                <Input style={{ width: 180 }} placeholder={t(p("accountHolderPlaceholder"))} />
              </Form.Item>
            ) : undefined
          }
          {
            searchType !== SearchType.selfAccount ? (
              <Form.Item label={t(p("operator"))} name="operatorIdOrName">
                <Input style={{ width: 180 }} placeholder={t(p("operatorPlaceholder"))} />
              </Form.Item>
            ) : undefined
          }
          <Form.Item label={t(p("topUpTime"))} name="time">
            <DatePicker.RangePicker allowClear={false} presets={getDefaultPresets(languageId)} />
          </Form.Item>
          <Form.Item label={t("common.type")} name="type">
            <Input style={{ width: 180 }} placeholder={t(p("searchTypePlaceholder"))} />
          </Form.Item>
          <Form.Item label={t(p("total"))}>
            <span>
              {data ? data.results.length : 0}
            </span>
          </Form.Item>
          <Form.Item label={t(p("sum"))}>
            <span>
              {data ? moneyNumberToString(data.total) : 0}
            </span>
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
        dataSource={data?.results as TableProps[]}
        onChange={handleTableChange}
        rowKey="index"
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          current: pageInfo.page,
          pageSize: pageInfo.pageSize,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          total: data?.totalCount ?? 0,
          onChange: (page, pageSize) => {
            setPageInfo({ page, pageSize });
          },
        }}
      >
        {
          searchType === SearchType.account
            ? (
              <>
                <Table.Column<TableProps>
                  dataIndex="accountName"
                  title={t(pCommon("account"))}
                  sorter={true}
                />
                <Table.Column<TableProps>
                  dataIndex="ownerId"
                  title={t(p("accountHolder"))}
                  width="13.5%"
                  render={(_, record) => `${record.ownerName}(ID: ${record.ownerId})`}
                />
              </>
            )
            : undefined
        }
        {
          searchType === SearchType.tenant
            ? (
              <Table.Column<TableProps>
                dataIndex="tenantName"
                title={t(pCommon("tenant"))}
                sorter={true}
              />
            )
            : undefined
        }
        <Table.Column<TableProps>
          dataIndex="time"
          title={t(p("paymentTime"))}
          width="13.5%"
          render={(v) => formatDateTime(v)}
          sorter={true}
        />
        <Table.Column<TableProps>
          dataIndex="amount"
          title={t(p("topUpAmount"))}
          width="10%"
          render={(v) => `${moneyNumberToString(v)}（${t(p("yuan"))}）`}
          sorter={true}
        />
        <Table.Column<TableProps>
          dataIndex="type"
          title={t(pCommon("type"))}
          width="15%"
          sorter={true}
        />
        {
          searchType !== SearchType.selfAccount ? (
            <>
              <Table.Column<TableProps>
                dataIndex="ipAddress"
                title={t(p("ipAddress"))}
                sorter={true}
              />
              <Table.Column<TableProps>
                dataIndex="operatorId"
                title={t(p("operator"))}
                render={(_, record) => `${record.operatorName}(ID: ${record.operatorId})`}
                width="10%"
                sorter={true}
              />
            </>
          ) : undefined
        }
        <Table.Column<TableProps>
          dataIndex="comment"
          title={t(pCommon("comment"))}
          width="20%"
          sorter={true}
        />
      </Table>
    </div>

  );
};
