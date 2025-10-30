import { Descriptions, message, Modal, Table } from "antd";
import { useCallback, useMemo } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis/api";
import { prefix, useI18nTranslateToString } from "src/i18n/index";
import { Encoding } from "src/models/exportFile";
import { ExportFileModaLButton } from "src/pageComponents/common/exportFileModal";
import { MAX_EXPORT_COUNT, urlToExport } from "src/pageComponents/file/apis";
import { BillInfo } from "src/pages/api/finance/bill";
import { moneyNumberToString, moneyToString } from "src/utils/money";

export interface Props {
  open: boolean;
  accountBill?: BillInfo;
  types: string[];
  onClose: () => void;
}

const p = prefix("pageComp.commonComponent.billTable.");
const pTitle = prefix("page.tenant.finance.bills.");
const pCommon = prefix("common.");

export const UserBillModal: React.FC<Props> = (
  { open, accountBill, onClose, types },
) => {

  const t = useI18nTranslateToString();

  const columns = [
    {
      dataIndex: "userId",
      title: t(pCommon("userId")),
    },
    {
      dataIndex: "name",
      title: t(pCommon("name")),
    },
    {
      dataIndex: "amount",
      title: t(p("subtotal")),
      render: (_, record) => {
        return moneyToString(record.amount);
      },
    },
  ];

  types.forEach((i) => {
    columns.push({
      dataIndex: i,
      title: i,
      render: (text) => {
        return text ? moneyNumberToString(Number(text)) : "-";
      },
    });
  });

  if (!accountBill) {
    return;
  }


  const promiseFn = useCallback(async () => {
    return api.getUserBills({ query: { accountBillIds:accountBill.ids, accountName: accountBill.accountName } });
  }, [accountBill.ids]);

  const { data, isLoading } = useAsync({
    promiseFn });

  const userBills = useMemo(() => {
    const ownerBill = data?.userBills.find((item) => item.userId === accountBill.accountOwnerId);
    const otherBill = data?.userBills.filter((item) => item.userId !== accountBill.accountOwnerId) || [];
    if (ownerBill) { otherBill.unshift(ownerBill); }
    return otherBill.map((i) => {
      return {
        ...i,
        ...i.details,
      };
    });
  },[data]);



  const handleExport = async (encoding: Encoding, columns: string[]) => {

    const total = userBills?.length || 0;

    if (total > MAX_EXPORT_COUNT) {
      message.error(t(pCommon("exportMaxDataErrorMsg"), [MAX_EXPORT_COUNT]));
    } else if (total <= 0) {
      message.error(t(pCommon("exportNoDataErrorMsg")));
    } else {
      // 获取浏览器时区
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      window.location.href = urlToExport({
        encoding,
        exportApi: "exportUserBill",
        columns,
        count: total,
        timeZone,
        query: {
          accountBillIds:accountBill.ids.map((i) => i.toString()),
          accountName: accountBill.accountName,
        },
      });
    }
  };

  const exportOptions = useMemo(() => {
    const common = [
      { label: t(pCommon("name")), value: "name" },
      { label: t(pCommon("userId")), value: "userId" },
      { label: t(p("subtotal")), value: "amount" },
    ];

    const typeOptions = types.map((i) => {
      return {
        label: i, value: i,
      };
    });

    return [...common, ...typeOptions];
  }, [t]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      style={{ maxWidth:"100%" }}
      footer={(
        <ExportFileModaLButton
          options={exportOptions}
          onExport={handleExport}
        >
          {t(pCommon("export"))}
        </ExportFileModaLButton>
      )}
    >
      <Descriptions title={t(pTitle("title"))}>
        <Descriptions.Item label={t(pCommon("account"))}>{accountBill.accountName}</Descriptions.Item>
        <Descriptions.Item label={t(pCommon("owner"))}>
          {accountBill.accountOwnerId}({accountBill.accountOwnerName})</Descriptions.Item>
        <Descriptions.Item label={t(p("term"))}>{accountBill.term}</Descriptions.Item>
      </Descriptions>
      <Table
        rowKey="useId"
        loading={isLoading}
        dataSource={userBills}
        pagination={false}
        columns={columns}
      />
    </Modal>
  );
};
