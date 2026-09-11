import { ExclamationCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { formatGBToMB, formatMBToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { Static } from "@sinclair/typebox";
import { App, Form, InputNumber, Modal, Space, Tooltip } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AccountQuotaInfo as AccountQuotaInfoSchema } from "src/pages/api/tenant/accountStorageQuota/getAccountQuota";
import { NUMERIC_GROUP_NAME_RESOLUTION_FAILED } from "src/utils/constants";

type AccountQuotaInfo = Static<typeof AccountQuotaInfoSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  // 单个账户模式
  accountName?: string;
  ownerName?: string;
  quotaMb?: number;
  usedStorageMb?: number;
  useDefault?: boolean;
  // 批量模式
  selectedAccounts?: AccountQuotaInfo[];
  isBatch?: boolean;
  // 共同属性
  storageId: string;
  storageLabel: string;
  totalStorageMb: number;
  defaultQuotaMb: number;
}

interface FormProps {
  quotaGB: number;
}

const p = prefix("pageComp.storage.accountQuotaChangeModal.");
const pCommon = prefix("common.");

export const AccountQuotaChangeModal: React.FC<Props> = ({
  open, onClose, reload, accountName, ownerName, storageId, storageLabel,
  quotaMb, usedStorageMb, totalStorageMb, useDefault, defaultQuotaMb,
  selectedAccounts, isBatch,
}) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { modal, message } = App.useApp();

  const handleGroupNameResolutionError = (error: { code?: string; details?: string }) => {
    if (error.code === NUMERIC_GROUP_NAME_RESOLUTION_FAILED) {
      message.error(`${t(p("modifyFailed"))}。${t("common.groupNameResolutionFailed")}${error.details ? ` ${error.details}` : ""}`);
    }
  };

  const callUseDefault = async (accountNames: string[]) => {
    return api
      .batchSetAccountQuota({
        body: {
          accountNames,
          storageId,
          quotaMb: defaultQuotaMb,
          useTenantDefaultAccountQuota: true,
        },
      }).httpError(412, () => {
        message.error(t(p("featureNotEnabled")));
      }).httpError(500, handleGroupNameResolutionError);
  };

  return (
    <Modal
      open={open}
      destroyOnClose={true}
      title={isBatch ? t(p("batchModifyStorageQuota")) : t(p("modifyStorageQuota"))}
      okText={t(p("confirm"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { quotaGB } = await form.validateFields();
        setLoading(true);

        if (isBatch && selectedAccounts) {
          const accountNames = selectedAccounts.map((a) => a.accountName);
          await api
            .batchSetAccountQuota({ body: { accountNames, storageId, quotaMb: Math.round(formatGBToMB(quotaGB)) } })
            .httpError(412, () => {
              message.error(t(p("featureNotEnabled")));
            })
            .httpError(500, handleGroupNameResolutionError)
            .then(({ failedAccountNames }) => {
              const failedNum = failedAccountNames.length;
              if (failedNum > 0) {
                message.warning(t(p("batchModifyPartialSuccess"), [accountNames.length - failedNum, failedNum]));
              } else {
                message.success(t(p("batchModifySuccess")));
              }
              reload();
              onClose();
            })
            .finally(() => setLoading(false));
        } else {
          await api
            .batchSetAccountQuota({
              body: {
                accountNames: [accountName!],
                storageId,
                quotaMb: Math.round(formatGBToMB(quotaGB)),
              },
            })
            .httpError(412, () => {
              message.error(t(p("featureNotEnabled")));
            })
            .httpError(500, handleGroupNameResolutionError)
            .then(({ failedAccountNames }) => {
              if (failedAccountNames.length > 0) {
                message.error(t(p("modifyFailed")));
              } else {
                message.success(t(p("modifySuccess")));
                reload();
                onClose();
              }
            })
            .finally(() => setLoading(false));
        }
      }}
    >
      <Form
        form={form}
        initialValues={{ quotaGB: isBatch ? undefined : parseFloat(formatMBToGB(quotaMb ?? 0).toFixed(2)) }}
        labelAlign="left"
        style={{ marginTop: "20px" }}
      >
        {isBatch ? (
          <Form.Item label={t(p("selectedAccounts"))} style={{ marginBottom: "10px" }}>
            <span>{selectedAccounts?.map((a) => a.accountName).join(", ")}</span>
          </Form.Item>
        ) : (
          <Form.Item label={t(p("account"))} style={{ marginBottom: "10px" }}>
            <span>{`${accountName}${ownerName ? ` (${ownerName})` : ""}`}</span>
          </Form.Item>
        )}
        <Form.Item label={t(p("storageSystem"))} style={{ marginBottom: "10px" }}>
          <span>{storageLabel}</span>
        </Form.Item>
        <Form.Item label={`${t(p("defaultStorageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
          <Space>
            <span>{formatMBToGB(defaultQuotaMb).toFixed(2)}</span>
            {isBatch && (
              <a onClick={() => {
                const accountNames = selectedAccounts?.map((a) => a.accountName) ?? [];
                modal.confirm({
                  title: t(p("batchUseDefaultStorageQuota")),
                  cancelText: t(pCommon("cancel")),
                  okText: t(pCommon("ok")),
                  icon: <ExclamationCircleOutlined />,
                  content: (
                    <Space direction="vertical">
                      <span>
                        {`${t(p("defaultStorageQuota"))}（GB）：`}
                        <span>{formatMBToGB(defaultQuotaMb).toFixed(2)}</span>
                      </span>
                      <span>{t(p("confirmBatchUseDefaultStorageQuota"))}</span>
                    </Space>
                  ),
                  onOk: async () => {
                    setLoading(true);
                    await callUseDefault(accountNames)
                      .then(({ failedAccountNames }) => {
                        const failedNum = failedAccountNames.length;
                        if (failedNum > 0) {
                          message.warning(
                            t(p("batchModifyPartialSuccess"), [accountNames.length - failedNum, failedNum]),
                          );
                        } else {
                          message.success(t(p("batchModifySuccess")));
                        }
                        reload();
                        onClose();
                      })
                      .finally(() => setLoading(false));
                  },
                });
              }}
              >
                {t(p("useDefaultValue"))}
              </a>
            )}
          </Space>
        </Form.Item>
        {!isBatch && quotaMb !== undefined && (
          <Form.Item label={`${t(p("currentUsage"))}/${t(p("storageQuota"))}(GB)`} style={{ marginBottom: "10px" }}>
            <Space>
              <span>{`${formatMBToGB(usedStorageMb ?? 0).toFixed(2)} / ${formatMBToGB(quotaMb).toFixed(2)}`}</span>
              {!useDefault && (
                <a onClick={() => {
                  modal.confirm({
                    title: t(p("useDefaultStorageQuota")),
                    cancelText: t(pCommon("cancel")),
                    okText: t(pCommon("ok")),
                    icon: <ExclamationCircleOutlined />,
                    content: (
                      <Space direction="vertical">
                        <span>
                          {`${t(p("defaultStorageQuota"))}（GB）：`}
                          <span>{formatMBToGB(defaultQuotaMb).toFixed(2)}</span>
                        </span>
                        <span>{t(p("confirmUseDefaultStorageQuota"))}</span>
                      </Space>
                    ),
                    onOk: async () => {
                      setLoading(true);
                      await callUseDefault([accountName!])
                        .then(({ failedAccountNames }) => {
                          if (failedAccountNames.length > 0) {
                            message.error(t(p("modifyFailed")));
                          } else {
                            message.success(t(p("modifySuccess")));
                            reload();
                            onClose();
                          }
                        })
                        .finally(() => setLoading(false));
                    },
                  });
                }}
                >
                  {t(p("useDefaultValue"))}
                </a>
              )}
            </Space>
          </Form.Item>
        )}
        <Form.Item
          label={
            <div>
              {t(p("setStorageQuota"))}
              <Tooltip title={t(p("tip"))}>
                <QuestionCircleOutlined style={{ marginLeft: 5 }} />
              </Tooltip>
            </div>
          }
          name="quotaGB"
          rules={[{ required: true }, { type: "number", min: 0.01, message: t(p("quotaMustBePositive")) }]}
        >
          <InputNumber min={0.01} max={totalStorageMb / 1024} precision={2} addonAfter={"GB"} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
