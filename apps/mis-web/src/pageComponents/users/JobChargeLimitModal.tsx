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

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { compareUsedChargeRule, positiveNumberRule } from "@scow/lib-web/build/utils/form";
import type { Money } from "@scow/protos/build/common/money";
import { App, Form, InputNumber, Modal, Space } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { UserStatus } from "src/models/User";
import { moneyToString } from "src/utils/money";

interface Props {
  username: string;
  userId: string;
  accountName: string;
  currentLimit?: Money;
  currentUsed?: Money;
  open: boolean;
  status: UserStatus;
  onClose: () => void;
  reload: () => void;
}

interface FormFields {
  limit: number;
}

interface FormFieldsConfirm {
  unblock: Boolean;
}

const p = prefix("pageComp.user.jobChargeLimitModal.");
const pCommon = prefix("common.");

export const JobChargeLimitModal: React.FC<Props> = ({
  accountName, onClose, reload, userId, open, username, currentLimit, currentUsed,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [form] = Form.useForm<FormFields>();
  const [confirmForm] = Form.useForm<FormFieldsConfirm>();
  const [loading, setLoading] = useState(false);

  const { message, modal } = App.useApp();

  const onOk = async () => {
    const { limit } = await form.validateFields();
    setLoading(true);
    await api.setJobChargeLimit({ body: { userId, accountName, limit } })
      .then(() => {
        message.success(t(p("setSuccess")));
        reload();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={`${currentLimit === undefined ? t(pCommon("set")) : t(pCommon("modify"))}${t(p("priceLimited"))}`}
      open={open}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={onOk}
    >
      <Form
        form={form}
        initialValues={{ limit: 0 }}
      >
        <Form.Item label={t(pCommon("user"))}>
          <strong>{username} (ID: {userId})</strong>
        </Form.Item>
        <Form.Item label={t(pCommon("accountName"))}>
          <strong>{accountName}</strong>
        </Form.Item>
        <Form.Item label={t(p("alreadyUsed"))}>
          {currentLimit && currentUsed
            ? (
              <Space>
                <span>
                  <strong>
                    {moneyToString(currentUsed)} / {moneyToString(currentLimit)}
                  </strong>
                </span>
                <a onClick={() => {
                  modal.confirm({
                    title: t(p("cancelPriceLimited")),
                    icon: <ExclamationCircleOutlined />,
                    content: <div>
                      <p>{t(p("confirmCancelLimited"))}</p>
                      <Form form={confirmForm}></Form>
                    </div>,
                    onOk: async () => {
                      await api.cancelJobChargeLimit({ query: { accountName, userId } })
                        .then(() => {
                          message.success(t(p("cancelSuccess")));
                          onClose();
                          reload();
                        });
                    },
                  });
                }}
                >
                  {t(p("cancelLimited"))}
                </a>
              </Space>
            )
            : t(p("unset")) }
        </Form.Item>
        <Form.Item
          name="limit"
          label={currentLimit ? t(p("changeLimited")) : t(p("setLimited"))}
          rules={[
            { required: true },
            { validator: (_, value) => positiveNumberRule(_, value, languageId) },
            { validator:
              (_, value) =>
                compareUsedChargeRule(_, value, currentUsed ? moneyToNumber(currentUsed) : undefined, languageId) },
          ]}
        >
          <InputNumber precision={2} min={0} />
        </Form.Item>
      </Form>

    </Modal>

  );
};

export const SetJobChargeLimitLink = ModalLink(JobChargeLimitModal);
