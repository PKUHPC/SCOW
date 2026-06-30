import type { Money } from "@scow/protos/build/common/money";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { compareUsedChargeRule, positiveNumberRule } from "@scow/lib-web/build/utils/form";
import { type AccountUserInfo } from "@scow/protos/build/server/user";
import { App, Form, InputNumber, Modal, Space } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

interface Props {
  accountName: string;
  batchFlag?: boolean;
  open: boolean;
  usersInfo: AccountUserInfo[];
  onClose: () => void;
  reload: () => void;
  setSelectedKeys?: (keys: React.Key[]) => void;
  setSelectedAccountUser?: (users: AccountUserInfo[]) => void;
}

interface FormFields {
  limit: number;
}

interface FormFieldsConfirm {
  unblock: boolean;
}

interface FormalUserInfo {
  usernames: string[];
  userIds: string[];
  userNameIds: string[];
  currentLimits: (Money | undefined)[];
  currentUseds: (Money | undefined)[];
  limitedFlag: boolean;
  usedAndLimit: string[];
  maxCurrentUseds: number;
}

const p = prefix("pageComp.user.jobChargeLimitModal.");
const pCommon = prefix("common.");

export const JobChargeLimitModal: React.FC<Props> = ({
  accountName,
  onClose,
  reload,
  setSelectedKeys,
  setSelectedAccountUser,
  usersInfo,
  open,
  batchFlag,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const [confirmForm] = Form.useForm<FormFieldsConfirm>();
  const [loading, setLoading] = useState(false);

  const { message, modal } = App.useApp();

  const formalUserInfo: FormalUserInfo = {
    usernames: [],
    userIds: [],
    currentLimits: [],
    currentUseds: [],
    userNameIds: [],
    limitedFlag: false,
    usedAndLimit: [],
    maxCurrentUseds: 0,
  };

  usersInfo.forEach((userInfo, index) => {
    formalUserInfo.usernames.push(userInfo.name);
    formalUserInfo.userIds.push(userInfo.userId);
    formalUserInfo.currentLimits.push(userInfo.jobChargeLimit);
    formalUserInfo.currentUseds.push(userInfo.usedJobChargeLimit);

    // 超过5个展示为 ...等5个用户、...等5个值
    if (index < 5) {
      formalUserInfo.userNameIds.push(`${userInfo.name} (ID: ${userInfo.userId})`);

      if (userInfo.jobChargeLimit && userInfo.usedJobChargeLimit) {
        formalUserInfo.usedAndLimit.push(
          `${moneyToString(userInfo.usedJobChargeLimit)} / ${moneyToString(userInfo.jobChargeLimit)}`,
        );
      } else {
        formalUserInfo.usedAndLimit.push(t(p("unset")));
      }
    } else if (index === 5) {
      formalUserInfo.userNameIds[4] =
        formalUserInfo.userNameIds[4] + `${t(p("andOtherUsers"), [usersInfo.length.toString()])}`;
      formalUserInfo.usedAndLimit[4] =
        formalUserInfo.usedAndLimit[4] + `${t(p("andOtherValues"), [usersInfo.length.toString()])}`;
    }

    if (userInfo.jobChargeLimit) {
      formalUserInfo.limitedFlag = true;
    }
    if (userInfo.usedJobChargeLimit && moneyToNumber(userInfo.usedJobChargeLimit) > formalUserInfo.maxCurrentUseds) {
      formalUserInfo.maxCurrentUseds = moneyToNumber(userInfo.usedJobChargeLimit);
    }
  });

  const onOk = async () => {
    const { limit } = await form.validateFields();
    setLoading(true);
    await api
      .setJobChargeLimit({ body: { userIds: formalUserInfo.userIds, accountName, limit } })
      .httpError(409, () => {
        message.error(t("common.accountUserSyncRunning"));
      })
      .httpError(500, () => {
        message.error(batchFlag ? t(p("batchChangeLimiteFailed")) : t(p("changeLimiteFailed")));
      })
      .then((res) => {
        if (res.success) {
          if (batchFlag) {
            message.success(t(p("batchSetSuccess")));
          } else {
            message.success(t(p("setSuccess")));
          }
        } else {
          const faileduserIds = res.results.filter((result) => result.success === false).map((r) => r.userId);
          message.error(t(p("batchLimitCompleted"), [faileduserIds.join("、")]));
        }
        if (setSelectedKeys) {
          setSelectedKeys([]);
        }
        if (setSelectedAccountUser) {
          setSelectedAccountUser([]);
        }
        reload();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={`${formalUserInfo.limitedFlag ? t(pCommon("modify")) : t(pCommon("set"))}${t(p("priceLimited"))}`}
      open={open}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={onOk}
    >
      <Form form={form} initialValues={{ limit: 0 }}>
        <Form.Item label={t(pCommon("user"))}>
          <span>{formalUserInfo.userNameIds?.join("、")}</span>
        </Form.Item>
        <Form.Item label={t(pCommon("accountName"))}>
          <span>{accountName}</span>
        </Form.Item>
        <Form.Item label={t(p("alreadyUsed"))}>
          <Space align="start">
            <span>{formalUserInfo.usedAndLimit?.join("、")}</span>
            <span style={{ whiteSpace: "nowrap" }}>
              {formalUserInfo.limitedFlag ? (
                <a
                  onClick={() => {
                    modal.confirm({
                      title: t(p("cancelPriceLimited")),
                      icon: <ExclamationCircleOutlined />,
                      content: (
                        <div>
                          <p>{batchFlag ? t(p("confirmCancelSelectLimited")) : t(p("confirmCancelLimited"))}</p>
                          <Form form={confirmForm}></Form>
                        </div>
                      ),
                      onOk: async () => {
                        const filterUserIds = usersInfo
                          .filter((user) => user.jobChargeLimit && user.usedJobChargeLimit)
                          .map((user) => user.userId);

                        await api
                          .cancelJobChargeLimit({ query: { accountName, userIds: filterUserIds } })
                          .httpError(409, () => {
                            message.error(t("common.accountUserSyncRunning"));
                          })
                          .httpError(500, () => {
                            message.error(batchFlag ? t(p("batchCleLimiteFailed")) : t(p("cancleLimiteFailed")));
                          })
                          .then((res) => {
                            if (res.success) {
                              if (batchFlag) {
                                message.success(t(p("batchCancelSuccess")));
                              } else {
                                message.success(t(p("cancelSuccess")));
                              }
                            } else {
                              const faileduserIds = res.results
                                .filter((result) => result.success === false)
                                .map((r) => r.userId);
                              message.error(t(p("batchCancleCompleted"), [faileduserIds.join("、")]));
                            }
                            if (setSelectedKeys) {
                              setSelectedKeys([]);
                            }
                            if (setSelectedAccountUser) {
                              setSelectedAccountUser([]);
                            }
                            onClose();
                            reload();
                          });
                      },
                    });
                  }}
                >
                  {t(p("cancelLimited"))}
                </a>
              ) : (
                ""
              )}
            </span>
          </Space>
        </Form.Item>
        <Form.Item
          name="limit"
          label={formalUserInfo.limitedFlag ? t(p("changeLimited")) : t(p("setLimited"))}
          rules={[
            { required: true },
            { validator: (_, value) => positiveNumberRule(_, value, languageId) },
            { validator: (_, value) => compareUsedChargeRule(_, value, formalUserInfo.maxCurrentUseds, languageId) },
          ]}
        >
          <InputNumber
            step={1 / Math.pow(10, publicConfig.JOB_CHARGE_DECIMAL_PRECISION)}
            precision={publicConfig.JOB_CHARGE_DECIMAL_PRECISION}
            min={0}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const SetJobChargeLimitLink = ModalLink(JobChargeLimitModal);
