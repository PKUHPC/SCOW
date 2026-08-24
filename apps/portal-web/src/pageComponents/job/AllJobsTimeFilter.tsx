import {
  DateTimeRange,
  DateTimeRangePicker,
  getDefaultDateTimeRange,
} from "@scow/lib-web/build/components/DateTimeRangePicker";
import { Form, Select, Space } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";

export type AllJobsTimeType = "submitTime" | "endTime";
export type AllJobsTimeRange = DateTimeRange;

interface Props {
  value?: AllJobsTimeRange;
  timeTypeSelectWidth: number;
  languageId: string;
  onChange?: (timeRange: AllJobsTimeRange) => void;
  onDraftChange?: (timeRange: AllJobsTimeRange) => void;
}

export const getDefaultAllJobsTimeRange = getDefaultDateTimeRange;

export const AllJobsTimeFilter = ({ value, timeTypeSelectWidth, languageId, onChange, onDraftChange }: Props) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.job.allJobsTable.searchForm.");

  return (
    <Form.Item>
      <Space size={8}>
        <Form.Item name="timeType" noStyle>
          <Select
            style={{ width: timeTypeSelectWidth }}
            options={[
              { value: "submitTime", label: t(p("submitTime")) },
              { value: "endTime", label: t(p("endTime")) },
            ]}
          />
        </Form.Item>
        <DateTimeRangePicker
          value={value}
          languageId={languageId}
          onChange={onChange}
          onDraftChange={onDraftChange}
          pickerWidth={210}
        />
      </Space>
    </Form.Item>
  );
};
