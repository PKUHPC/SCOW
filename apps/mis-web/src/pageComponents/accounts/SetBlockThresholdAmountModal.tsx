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
import type { Money } from "@scow/protos/build/common/money";
import { App, Form, InputNumber, Modal, Space } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

interface Props {
  accountName: string;
  currentAmount: Money | undefined;
  defaultBlockThresholdAmount: Money;
  balance: Money;
  open: boolean;
  onClose: () => void;
  reload: () => void;
}

interface FormFields {
  blockThresholdAmount: number;
}


const p = prefix("pageComp.accounts.setBlockThresholdAmountModal.");
const pCommon = prefix("common.");

export const SetBlockThresholdAmountModal: React.FC<Props> = ({
  accountName, onClose, reload, open, currentAmount, defaultBlockThresholdAmount, balance,
}) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormFields>();
  const [loading, setLoading] = useState(false);

  const { message, modal } = App.useApp();


  const setBlockThresholdAmount = async (blockThresholdAmount?: number | undefined) => {
    setLoading(true);
    await api.setBlockThreshold({ body: { accountName, blockThresholdAmount } })
      .then((res) => {
        if (res.executed) {
          message.success(t(p("setSuccess")));
          reload();
          onClose();
        } else {
          message.error(res.reason || t(p("setFail")));
        }
      })
      .finally(() => setLoading(false));
  };

  const onOk = async () => {

    const { blockThresholdAmount } = await form.validateFields();

    await setBlockThresholdAmount(blockThresholdAmount);

  };

  return (
    <Modal
      title={`${t(pCommon("modify"))}${t(p("blockThresholdAmount"))}`}
      open={open}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={onOk}
    >
      <Form
        form={form}
      >
        <Form.Item label={t(pCommon("accountName"))}>
          <span>{accountName}</span>
        </Form.Item>
        <Form.Item label={t(pCommon("balance"))}>
          <span>{moneyToString(balance)} {t(pCommon("unit"))}</span>
        </Form.Item>
        <Form.Item label={t(p("defaultBlockThresholdAmount"))}>
          <span>{moneyToString(defaultBlockThresholdAmount)} {t(pCommon("unit"))}</span>
        </Form.Item>
        <Form.Item label={t(p("curBlockThresholdAmount"))}>
          <Space>
            { <span>{currentAmount ? (
              <>
                {moneyToString(currentAmount)} {t(pCommon("unit"))}
              </>
            ) : (
              t(p("defaultBlockThresholdAmount"))
            )} </span> }
            { currentAmount !== undefined && (
              <a onClick={() => {
                modal.confirm({
                  title: t(p("useDefaultBlockThresholdAmount")),
                  icon: <ExclamationCircleOutlined />,
                  content: <Space direction="vertical">
                    <span>{t(p("curDefaultBlockThresholdAmount"))}
                      <span>
                        {moneyToString(defaultBlockThresholdAmount)} {t(pCommon("unit"))}
                      </span>
                    </span>
                    <span>{t(p("confirmUseDefaultBlockThresholdAmount"))}</span>
                  </Space>,
                  onOk: async () => {
                    await setBlockThresholdAmount();
                  },
                });
              }}
              >
                {t(p("useDefaultBlockThresholdAmount"))}
              </a>
            )}

          </Space>
        </Form.Item>
        <Form.Item
          name="blockThresholdAmount"
          label={t(p("setAmount"))}
          rules={[
            { required: true },
          ]}
        >
          <InputNumber
            step={1 / Math.pow(10, publicConfig.JOB_CHARGE_DECIMAL_PRECISION)}
            precision={publicConfig.JOB_CHARGE_DECIMAL_PRECISION}
          />
        </Form.Item>
      </Form>

    </Modal>

  );
};

export const SetBlockThresholdAmountLink = ModalLink(SetBlockThresholdAmountModal);
