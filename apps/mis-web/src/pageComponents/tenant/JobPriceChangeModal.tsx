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
  cluster: string;
}

const p = prefix("pageComp.tenant.jobPriceChangeModal.");
const pCommon = prefix("common.");

export const JobPriceChangeModal: React.FC<Props> = ({ open, onClose, jobs, reload, setSelectedJobs }) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  const biJobIndexs = jobs?.map((record) => {
    return record?.biJobIndex;
  });

  const clusters = jobs?.map((record) => {
    return record?.cluster;
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

  /**
   * 格式化作业名称和ID列表
   * @param {string[]} jobNames - 作业名称数组
   * @param {number[]} jobIds - 作业ID数组
   * @returns {JSX.Element} - 格式化后的JSX元素（含换行）
   */
  const formatJobNames = (jobNames: string[], jobIds: number[]) => {

    const count = jobNames.length;
    const maxDisplay = 3;

    // 1. 只截取前3个用于格式化
    const displayJobNames = jobNames.slice(0, maxDisplay);
    const remainingCount = count - maxDisplay;
    const showSummary = remainingCount > 0;

    return (
      <>
        {displayJobNames.map((name, index) => {
          const id = jobIds[index];
          const jobStr = `${name}(ID: ${id})`;

          // 判断是否是列表中的最后一个显示项 (即 index == 2)
          const isLastDisplayed = index === maxDisplay - 1;

          const output = jobStr;

          // 2. 如果是第3个作业，且还有剩余，则添加摘要文本
          if (isLastDisplayed && showSummary) {
            return (
              <span key={index}>
                {jobStr + t(p("jobSummaryEllipsis"), [count.toString()])}
              </span>
            );
          }

          // 3. 否则，如果不是最后一个，添加换行 <br />
          return (
            <span key={index}>
              {output}
              {index < displayJobNames.length - 1 && (<>,<br /></>)}
            </span>
          );
        })}
      </>
    );
  };

  /**
 * 格式化作业计费列表
 * @param {(string | 0)[]} prices - 价格数组
 * @returns {JSX.Element} - 格式化后的JSX元素
 */
  const formatPrices = (prices: (string | 0)[]) => {
    const count = prices.length;
    const maxDisplay = 3;

    // 1. 只截取前3个用于格式化
    const displayPrices = prices.slice(0, maxDisplay);
    const remainingCount = count - maxDisplay;
    const showSummary = remainingCount > 0;

    return (
      <>
        {displayPrices.map((price, index) => {
          const priceStr = price.toString();

          // 判断是否是列表中的最后一个显示项 (即 index == 2)
          const isLastDisplayed = index === maxDisplay - 1;

          // 2. 如果是第3个价格，且还有剩余，则添加摘要文本
          if (isLastDisplayed && showSummary) {
            return (
              <span key={index}>
                {priceStr + t(p("priceSummaryEllipsis"), [count.toString()])}
              </span>
            );
          }

          return (
            <span key={index}>
              {priceStr}
              {index !== count - 1 && ", "}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <Modal
      open={open}
      title={t(p("adjustBill"))}
      okText={t(pCommon("ok"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={async () => {
        const { price, reason } = await form.validateFields();

        setLoading(true);
        await api.changeJobPrice({ body: { jobIds, biJobIndexs, price, reason, target: "account", clusters } })
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
        <table style={{ width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "170px" }} />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <td style={{
                verticalAlign: "top",
                paddingTop: "4px",
                paddingBottom: "16px",
                paddingRight: "24px",
              }}
              >
                {t(p("job"))}
              </td>
              <td style={{ verticalAlign: "top", paddingTop: "4px", paddingBottom: "16px" }}>
                <span>{formatJobNames(jobNames, jobIds)}</span>
              </td>
            </tr>

            <tr>
              <td style={{
                fontWeight: 500,
                verticalAlign: "top",
                paddingTop: "4px",
                paddingBottom: "16px",
                paddingRight: "24px",
              }}
              >
                {t(p("currentPrice"))}
              </td>
              <td style={{ verticalAlign: "top", paddingTop: "4px", paddingBottom: "16px" }}>
                <span>{formatPrices(accountPrices)}</span>
              </td>
            </tr>

            <tr>
              <td
                style={{
                  fontWeight: 500,
                  verticalAlign: "top",
                  paddingTop: "4px",
                  paddingBottom: "16px",
                  paddingRight: "24px",
                }}
              >
                <Form.Item
                  required
                  label={(
                    <Space>
                      {t(p("setBill"))}
                      <Popover
                        placement="right"
                        content={<div style={{ maxWidth: "320px" }}>{t(p("annotation"))}</div>}
                      >
                        <QuestionCircleOutlined />
                      </Popover>
                    </Space>
                  )}
                  colon={false}
                  style={{ margin: 0 }}
                />
              </td>
              <td style={{ verticalAlign: "top", paddingBottom: "16px" }}>
                <Form.Item name="price" rules={[{ required: true }]}>
                  <InputNumber
                    min={0}
                    step={1 / Math.pow(10, publicConfig.JOB_CHARGE_DECIMAL_PRECISION)}
                    precision={publicConfig.JOB_CHARGE_DECIMAL_PRECISION}
                    addonAfter={t(pCommon("unit"))}
                  />
                </Form.Item>
              </td>
            </tr>

            <tr>
              <Form.Item
                label={t(p("reason"))}
                required
                style={{ margin: 0 }}
                colon={false}
              />
              <td style={{ verticalAlign: "top" }}>
                <Form.Item name="reason" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <Input.TextArea />
                </Form.Item>
              </td>
            </tr>
          </tbody>
        </table>
      </Form>
    </Modal>
  );
};
