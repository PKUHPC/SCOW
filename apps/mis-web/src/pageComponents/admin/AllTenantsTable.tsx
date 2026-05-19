import { moneyToNumber } from "@scow/lib-decimal";
import {
  compareNullableDateTime,
  compareNullableNumber,
  compareNullableString,
} from "@scow/lib-web/build/utils/compareNullableValue";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Money } from "@scow/protos/build/common/money";
import { PlatformTenantsInfo } from "@scow/protos/build/server/tenant";
import { Static } from "@sinclair/typebox";
import { Table } from "antd";
import { ColumnsType } from "antd/es/table";
import React, { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { type GetAllTenantsSchema } from "src/pages/api/admin/getAllTenants";
import { moneyToString } from "src/utils/money";

interface Props {
  refreshToken: boolean;
}
const p = prefix("pageComp.admin.allTenantsTable.");
const pCommon = prefix("common.");

export const AllTenantsTable: React.FC<Props> = ({ refreshToken }) => {
  const promiseFn = useCallback(async () => {
    return await api.getAllTenants({});
  }, []);
  const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

  return (
    <div>
      <TenantInfoTable data={data} isLoading={isLoading} reload={reload} />
    </div>
  );
};
interface TenantInfoTableProps {
  data: Static<(typeof GetAllTenantsSchema)["responses"]["200"]> | undefined;
  isLoading: boolean;
  reload: () => void;
}

const TenantInfoTable: React.FC<TenantInfoTableProps> = ({ data, isLoading }) => {
  const t = useI18nTranslateToString();

  const columns: ColumnsType<PlatformTenantsInfo> = [
    {
      dataIndex: "tenantName",
      title: t(p("tenantName")),
      width: "35%",
      sorter: (a, b) => compareNullableString(a.tenantName, b.tenantName),
    },
    {
      dataIndex: "userCount",
      title: t(pCommon("userCount")),
      sorter: (a, b) => compareNullableNumber(a.userCount, b.userCount),
    },
    {
      dataIndex: "accountCount",
      title: t(p("accountCount")),
      sorter: (a, b) => compareNullableNumber(a.accountCount, b.accountCount),
    },
    {
      dataIndex: "balance",
      title: t(pCommon("balance")),
      render: (balance: Money) => moneyToString(balance),
      sorter: (a, b) =>
        compareNullableNumber(
          a.balance ? moneyToNumber(a.balance) : undefined,
          b.balance ? moneyToNumber(b.balance) : undefined,
        ),
    },
    {
      dataIndex: "createTime",
      title: t(pCommon("createTime")),
      render: (time: string) => formatDateTime(time),
      sorter: (a, b) => compareNullableDateTime(a.createTime, b.createTime),
    },
  ];

  return (
    <Table
      tableLayout="fixed"
      dataSource={data?.platformTenants}
      columns={columns}
      loading={isLoading}
      rowKey="tenantId"
      pagination={{
        showSizeChanger: true,
        defaultPageSize: DEFAULT_PAGE_SIZE,
      }}
    />
  );
};
