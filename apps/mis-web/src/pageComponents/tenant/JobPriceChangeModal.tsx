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

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Money } from "@scow/protos/build/common/money";
import { App, Form, Input, InputNumber, Modal, Popover, Space } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import type { GetJobFilter } from "src/pages/api/job/jobInfo";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

interface Props {
  open: boolean;
  onClose: () => void;
  jobCount: number;
  filter: GetJobFilter;
  reload: () => void;
  target: "account" | "tenant";
  jobs: JobItem[];
  setSelectedJobs: (selectJobs: JobItem[]) => void;
}

interface FormProps {
  price: number;
  reason: string;
}

interface JobItem {
  idJob: number;
  biJobIndex: number;
  jobName: string;
  accountPrice?: Money
}

const p = prefix("pageComp.tenant.jobPriceChangeModal.");
const pCommon = prefix("common.");



export const JobPriceChangeModal: React.FC<Props> = ({ open, onClose, jobs, target, reload, setSelectedJobs }) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  const text = {
    "account": t(p("tenantPrice")),
    "tenant": t(p("platformPrice")),
  };

  const biJobIndexs = jobs?.map((record) => {
    return record?.biJobIndex;
  });

  const jobIds = jobs?.map((record) => {
    return record?.idJob;
  });
  const jobNames = jobs?.map((record) => {
    return record?.jobName;
  });
  const accountPrices = jobs?.map((record) => {
    return record?.accountPrice ? moneyToString(record.accountPrice) : 0;
  });

  return (
    <Modal
      open={open}
      title={`${t(p("changeJob"))}${text[target]}`}
      okText={`${t(p("modifyButton"))}${text[target]}`}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { price, reason } = await form.validateFields();

        setLoading(true);
        await api.changeJobPrice({ body: { jobIds, biJobIndexs, price, reason, target } })
          .httpError(404, (e) => {
            message.error({
              content: e.message.split(": ")[1],
              duration: 4,
            });
            reload();
            onClose();
          })
          .httpError(409, () => {
            message.error(t("common.accountUserSyncRunning"));
            reload();
            onClose();
          })
          .then(() => {
            message.success(t(pCommon("changeSuccess")));
            reload();
            onClose();
            setSelectedJobs([]);
          })
          .finally(() => setLoading(false));

      }}
    >
      <Form form={form}>
        <Form.Item label={t(p("job"))}>
          <span>{`${jobNames.toString()}(ID: ${jobIds.toString()})`}</span>
        </Form.Item>
        <Form.Item label={t(p("currentPrice"))}>
          <span>{accountPrices.toString()}</span>
        </Form.Item>

        <Form.Item
          label={(
            <Space>{`${t(p("newJob"))}${text[target]}`}
              <Popover placement="right" content={<div style={{ maxWidth: "320px" }}>{t(p("annotation"))}</div>}>
                <QuestionCircleOutlined />
              </Popover>
            </Space>
          )}
          name="price"
          rules={[{ required: true }]}
        >
          <InputNumber
            min={0}
            step={1 / Math.pow(10, publicConfig.JOB_CHARGE_DECIMAL_PRECISION)}
            precision={publicConfig.JOB_CHARGE_DECIMAL_PRECISION}
            addonAfter={t(pCommon("unit"))}
          />
        </Form.Item>
        <Form.Item name="reason" label={t(p("reason"))} rules={[{ required: true }]}>
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
