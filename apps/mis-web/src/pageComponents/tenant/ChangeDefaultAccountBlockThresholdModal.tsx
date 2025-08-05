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

import type { Money } from "@scow/protos/build/common/money";
import { App, Form, InputNumber, Modal } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

interface Props {
  tenantName: string;
  currentAmount: Money;
  open: boolean;
  onClose: () => void;
  reload: () => void;
}

interface FormFields {
  blockThresholdAmount: number;
}


const p = prefix("pageComp.tenant.changeDefaultAccountBlockThresholdModal.");
const pCommon = prefix("common.");

export const ChangeDefaultAccountBlockThresholdModal: React.FC<Props> = ({
  tenantName, onClose, reload, open, currentAmount,
}) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormFields>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  const onOk = async () => {
    const { blockThresholdAmount } = await form.validateFields();
    setLoading(true);
    await api.setDefaultAccountBlockThreshold({ body: { tenantName, blockThresholdAmount } })
      .then((res) => {
        if (res.executed) {
          message.success(t(pCommon("changeSuccess")));
          reload();
          onClose();
        } else {
          message.error(res.reason || t(pCommon("changeFail")));
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={`${t(pCommon("modify"))}${t(p("defaultAccountBlockThresholdAmount"))}`}
      open={open}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={onOk}
    >
      <Form
        form={form}
        initialValues={{ blockThresholdAmount: moneyToString(currentAmount) }}
      >
        <Form.Item label={t(pCommon("tenantName"))}>
          <span>{tenantName}</span>
        </Form.Item>
        <Form.Item name="blockThresholdAmount" label={t(p("setAmount"))} required>
          <InputNumber
            step={1 / Math.pow(10, publicConfig.JOB_CHARGE_DECIMAL_PRECISION)}
            precision={publicConfig.JOB_CHARGE_DECIMAL_PRECISION}
          />
        </Form.Item>
      </Form>

    </Modal>

  );
};

export const ChangeDefaultAccountBlockThresholdLink = ModalLink(ChangeDefaultAccountBlockThresholdModal);
