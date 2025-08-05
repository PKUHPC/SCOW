import { Decimal, moneyToNumber } from "@scow/lib-decimal";
import { getMonthlyBillPresets, getYearlyBillPresets } from "@scow/lib-web/build/utils/datetime";
import { useDidUpdateEffect } from "@scow/lib-web/build/utils/hooks";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Button, DatePicker, Form, Input, message, Radio, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { DetailIcon } from "src/assets/operationIcon";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { BillType } from "src/models/bill";
import { Encoding } from "src/models/exportFile";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { AccountMultiSelector } from "src/pageComponents/finance/AccountMultiSelector";
import { BillInfo } from "src/pages/api/finance/bill";
import { moneyNumberToString, moneyToString } from "src/utils/money";

import { UserBillModal } from "./UserBillModal";

export enum SearchType {
  // 仅搜索自己账户
  selfAccount = "selfAccount",
  // 仅搜索自己租户
  selfTenant = "selfTenant",
}

interface Props {
  // 账户充值记录专用项
  accountNames?: string[];
  // 搜索类型, self前缀表示只搜索用户自身的账户或租户
  searchType?: SearchType;
  types: string[];
  loading: boolean;
}

interface FilterForm {
  userIdsOrNames?: string;
  accountNames?: string[];
  type: BillType ;
  term?: [dayjs.Dayjs, dayjs.Dayjs],
}


const p = prefix("pageComp.commonComponent.billTable.");
const pCommon = prefix("common.");

export const BillTable: React.FC<Props> = ({ accountNames, searchType, types = []}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [query, setQuery] = useState<FilterForm>({
    userIdsOrNames: undefined,
    type: BillType.MONTHLY,
    term: [dayjs().subtract(1, "month"), dayjs().subtract(1, "month")],
    accountNames: searchType === SearchType.selfAccount ? accountNames : undefined,
  });
  const [open,setOpen] = useState<boolean>(false);
  const [accountBill,setAccountBill] = useState<BillInfo | undefined>(undefined);
  const [selectedNames, setSelectedNames] = useState<string[] | undefined>(accountNames);

  const type = Form.useWatch("type", form);

  useEffect(() => {
    if (type === BillType.YEARLY) {
      if (searchType === SearchType.selfAccount) {
        form.setFieldValue("term", [dayjs().subtract(10, "year"), dayjs().subtract(1, "year")]);
      } else {
        form.setFieldValue("term", [dayjs().subtract(1, "year"), dayjs().subtract(1, "year")]);
      }
    }
    if (type === BillType.MONTHLY) {
      if (searchType === SearchType.selfAccount) {
        form.setFieldValue("term", [dayjs().subtract(1, "year"), dayjs().subtract(1, "month")]);
      } else {
        form.setFieldValue("term", [dayjs().subtract(1, "month"), dayjs().subtract(1, "month")]);
      }
    }

  },[type]);

  // 在账户管理下切换不同账户账单明细页面时
  useDidUpdateEffect(() => {
    const initialValues: FilterForm = {
      accountNames,
      userIdsOrNames: undefined,
      type: BillType.MONTHLY,
      // 此处默认查过去一年的账单
      term: [dayjs().subtract(1, "year"), dayjs().subtract(1, "month")],
    };
    form.setFieldsValue(initialValues);
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
    setQuery(initialValues);
    setSelectedNames(accountNames);
  }, [accountNames]);

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const param = {
        ...pageInfo,
        ...query,
        termStart: query.term?.[0].format(type === BillType.YEARLY ? "YYYY" : "YYYYMM"),
        termEnd: query.term?.[1].format(type === BillType.YEARLY ? "YYYY" : "YYYYMM"),
      };
      // 平台管理下的账单
      return api.getBills({ query: { ...param , searchType } });
    }, [query, pageInfo]),
  });

  const columns = [
    {
      dataIndex: "index",
      title: t(pCommon("serialNumber")),
      render: (text, record, index) => {
        return index + 1;
      },
    },
    {
      dataIndex:"accountName",
      title: t(pCommon("account")),
    },
    {
      dataIndex: "accountOwnerName",
      title: t(pCommon("owner")),
      render: (text, record) => {
        return `${text} (${record.accountOwnerId})`;
      },
    },
    {
      dataIndex: "term",
      title: t(p("term")),
    },
    {
      dataIndex: "amount",
      title: t(p("totalAmount")),
      render: (_, record) => {
        return moneyToString(record.amount);
      },
    },
  ];

  // 如果是账户管理员，去掉账户名和账户拥有者两个列
  if (searchType === SearchType.selfAccount) {
    columns.splice(1,2);
  }

  // 根据从后端查询到的账单类型动态增加column类型
  types.forEach((i) => {
    columns.push({
      dataIndex: i,
      title: i,
      render: (text) => {
        return text ? moneyNumberToString(Number(text)) : "-";
      },
    });
  });

  columns.push({
    dataIndex: "action",
    title: t(pCommon("operation")),
    render: (text, record) => {
      return new Decimal(moneyToNumber(record.amount)).isEqualTo(0) ? "-" : (
        <Tooltip title={t(pCommon("detail"))}>
          <DetailIcon
            onClick={() => {
              setOpen(true);
              setAccountBill(record);
            }}
          />
        </Tooltip>
      );
    },
  });

  const bills = useMemo(() => {
    return data?.bills.map((i) => {
      return {
        ...i,
        ...i.details,
      };
    });
  },[data]);


  const handleExport = async (columns: string[], encoding: Encoding) => {

    const total = data?.total ?? 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
    // 获取浏览器时区
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      window.location.href = urlToExport({
        encoding,
        exportApi: "exportBill",
        columns,
        count: total,
        timeZone,
        query: {
          ...query.term ? {
            termStart: query.term?.[0].format(type === BillType.YEARLY ? "YYYY" : "YYYYMM"),
            termEnd: query.term?.[1].format(type === BillType.YEARLY ? "YYYY" : "YYYYMM"),
          } : {},
          userIdsOrNames: query.userIdsOrNames,
          type: query.type,
          accountNames: query.accountNames,
          searchType,
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    const common = [
      { label: t(pCommon("account")), value: "accountName" },
      { label: t(pCommon("owner")), value: "accountOwnerName" },
      { label: t(p("term")), value: "term" },
      { label: t(pCommon("amount")), value: "amount" },
    ];

    if (searchType === SearchType.selfAccount) {
      common.splice(0,2);
    }

    const typeOptions = types.map((i) => {
      return {
        label: i, value: i,
      };
    });

    return [...common, ...typeOptions];
  }, [t, searchType]);

  const handleSearch = async () => {
    const { userIdsOrNames, type, term, accountNames } = await form.validateFields();
    setQuery({ userIdsOrNames, type, term, accountNames: selectedNames ?? accountNames });
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
  };

  return (
    <div>

      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={handleSearch}
        >

          <Form.Item name="type" label={t(p("statisticalCycle"))}>
            <Radio.Group
              buttonStyle="solid"
              onChange={handleSearch}
            >
              <Radio.Button value={BillType.SUMMARY}>{t(p("summary"))}</Radio.Button>
              <Radio.Button value={BillType.MONTHLY}>{t(p("month"))}</Radio.Button>
              <Radio.Button value={BillType.YEARLY}>{t(p("year"))}</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label={t(p("term"))} name="term">
            <DatePicker.RangePicker
              picker={ type === BillType.YEARLY ? "year" : "month" }
              allowClear={false}
              presets={type === BillType.YEARLY ? getYearlyBillPresets(languageId) : getMonthlyBillPresets(languageId)}
            />
          </Form.Item>

          {searchType !== SearchType.selfAccount ? (
            <Form.Item
              label={t(pCommon("account"))}
              name="accountNames"
            >
              <AccountMultiSelector
                value={selectedNames ?? []}
                onChange={(item) => {
                  setSelectedNames(item);
                }}
                fromAllTenants={searchType !== SearchType.selfTenant}
                placeholder={t(pCommon("selectAccount"))}
              />
            </Form.Item>
          ) : ""}

          {searchType !== SearchType.selfAccount ? (
            <Form.Item name="userIdsOrNames" label={t(pCommon("ownerIdOrName"))}>
              <Input allowClear placeholder={t(pCommon("ownerIdOrName"))} />
            </Form.Item>
          ) : ""}

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
        rowKey={(i) => i.id}
        dataSource={bills}
        columns={columns}
        loading={isLoading}
        scroll={{ x: true }}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: 10,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.total,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
      />

      <UserBillModal
        open={open}
        accountBill={accountBill}
        types={types}
        onClose={() => { setOpen(false); }}
      />
    </div>
  );
};
