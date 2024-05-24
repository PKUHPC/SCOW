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

import { arrayContainsElement } from "@scow/lib-web/build/utils/array";
import { parseMinutes, TimeUnits } from "@scow/lib-web/build/utils/datetime";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Divider, Form, InputNumber, Modal, Progress, Select } from "antd";
import { useRef, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { RunningJobInfo } from "src/models/job";
import type { Cluster } from "src/utils/config";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;

  data: RunningJobInfo[];
}

interface FormProps {
  limitValue: number;
}

interface CompletionStatus {
  total: number;
  success: number;
  failed: RunningJobInfo[];

}

const p = prefix("pageComp.job.ChangeJobTimeLimitModal.");
const pCommon = prefix("common.");

export const ChangeJobTimeLimitModal: React.FC<Props> = ({ open, onClose, data, reload }) => {

  const t = useI18nTranslateToString();

  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const completionStatus = useRef<CompletionStatus | undefined>(undefined);

  const dataGroupedByCluster = data.reduce((prev, curr) => {
    if (!prev.has(curr.cluster)) {
      prev.set(curr.cluster, []);
    }
    prev.get(curr.cluster)!.push(curr);
    return prev;
  }, new Map<Cluster, RunningJobInfo[]>());

  const close = () => {
    completionStatus.current = undefined;
    onClose();
  };

  const [timeUnit, setTimeUnit] = useState<TimeUnits>(TimeUnits.MINUTE);
  const timeUnitsI18nTexts = {
    [TimeUnits.MINUTE]: t("common.timeUnits.minute"),
    [TimeUnits.HOUR]: t("common.timeUnits.hour"),
    [TimeUnits.DAY]: t("common.timeUnits.day"),
  };

  const selectAfter = (
    <Select
      labelInValue
      defaultValue={{ value: TimeUnits.MINUTE, label: timeUnitsI18nTexts[TimeUnits.MINUTE] }}
      options={Object.keys(timeUnitsI18nTexts).map((x) => ({ label: timeUnitsI18nTexts[x], value: x }))}
      onChange={(v) => setTimeUnit(v.value)}
    />
  );

  return (
    <Modal
      open={open}
      title={t(p("modifyLimit"))}
      okText={t(pCommon("modify"))}
      cancelText={t(pCommon("cancel"))}
      onCancel={close}
      confirmLoading={loading}
      destroyOnClose
      onOk={async () => {
        const { limitValue } = await form.validateFields();
        const limitTimeMinutes = parseMinutes(limitValue, timeUnit);

        setLoading(true);

        completionStatus.current = { total: data.length, success: 0, failed: []};

        await Promise.all(data.map(async (r) => {
          await api.changeJobTimeLimit({ body: {
            cluster: r.cluster.id,
            limitMinutes: limitTimeMinutes,
            jobId: r.jobId,
          } })
            .httpError(400, (e) => {
              if (e.code === "TIME_LIME_NOT_VALID") {
                message.error(t(p("timeLimeError")));
              };
              if (e.code === "SYSTEM_UNALLOWED") {
                message.error(e.message);
              }
              throw e;
            })
            .then(() => {
              if (completionStatus.current) {
                completionStatus.current.success++;
              }
            }).catch(() => {
              if (completionStatus.current) {
                completionStatus.current.failed.push(r);
              }
            });
        }))
          .then(() => {
            if (completionStatus.current) {
              if (completionStatus.current.failed.length === 0) {
                message.success(t(p("success")));
                reload();
                close();
              } else {
                message.error(t(p("fail")));
                reload();
              }
            }
          })
          .finally(() => setLoading(false));

      }}
    >
      <Form form={form} initialValues={{ limitValue: 1 }}>
        {
          Array.from(dataGroupedByCluster.entries()).map(([cluster, data]) => (
            <>
              <Form.Item label={t(pCommon("cluster"))}>
                <strong>{getI18nConfigCurrentText(cluster.name, languageId)}</strong>
              </Form.Item>
              <Form.Item label={t(pCommon("workId"))}>
                <strong>
                  {data.map((x) => x.name).join(", ")}
                  <span>
                    &nbsp;&nbsp;(ID:&nbsp;{data.map((x) => x.jobId).join(", ")})
                  </span>
                </strong>
              </Form.Item>
              <Form.Item label={t(p("currentTimeLimit"))}>
                <strong>{data.map((x) => x.timeLimit).join(", ")}</strong>
              </Form.Item>
              <Divider />
            </>
          ))
        }
        <Form.Item<FormProps>
          label={t(p("setLimit"))}
          rules={[{ required: true }]}
          tooltip={(
            <>
              <span>{t(p("timeExplanation"))}</span>
            </>
          )}
        >
          <Form.Item name="limitValue" noStyle>
            <InputNumber min={1} step={1} addonAfter={selectAfter} />
          </Form.Item>
        </Form.Item>
      </Form>
      {
        completionStatus.current
          ? (
            ((curr: CompletionStatus) => (
              <Progress
                percent={(curr.success + curr.failed.length) / curr.total * 100}
                success={{ percent: curr.success / curr.total * 100 }}
                format={() => `${curr.success} / ${curr.total}`}
              />
            ))(completionStatus.current)
          ) : (
            <Progress
              percent={0}
              success={{ percent: 0 }}
              format={() => `0/${data.length}`}
            />
          )
      }
      {
        arrayContainsElement(completionStatus?.current?.failed)
          ? (
            <Form.Item label={t(p("modifyWork"))}>
              <strong>{completionStatus.current!.failed.map((x) => x.jobId).join(", ")}</strong>
            </Form.Item>
          ) : undefined
      }
    </Modal>
  );
};
