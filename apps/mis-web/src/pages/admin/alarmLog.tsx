import { QuestionCircleOutlined } from "@ant-design/icons";
import { getInclusiveDateRangeStart } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Button, Form, Popover, Select, Space } from "antd";
import dayjs from "dayjs";
import { NextPage } from "next";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { DateTimeRangePicker } from "src/components/DateTimeRangePicker";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { AllAlarmLogsTable } from "src/pageComponents/admin/AllAlarmLogsTable";
import { Head } from "src/utils/head";

interface FilterForm {
  time: [dayjs.Dayjs, dayjs.Dayjs];
  status: string;
  id: number | undefined;
  uid: string | undefined;
  type: string | undefined;
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const p = prefix("page.admin.monitor.alarmLog.");

export const AlarmLogPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(() => {
  const [query, setQuery] = useState<FilterForm>(() => {
    const now = dayjs();
    return {
      time: [getInclusiveDateRangeStart(now, 1, "week"), now.endOf("day")],
      status: "",
      id: undefined,
      uid: undefined,
      type: undefined,
    };
  });
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const t = useI18nTranslateToString();
  const [form] = Form.useForm<FilterForm>();

  const getAlarmLogs = useCallback(async () => {
    if (!query.id || !query.uid || !query.type) {
      return;
    }

    return await api.getAlarmLogs({
      query: {
        from: query.time[0].valueOf(),
        to: query.time[1].valueOf(),
        status: query.status || "",
        id: query.id,
        uid: query.uid,
        type: query.type,
        page: pageInfo.page,
        pageSize: pageInfo.pageSize!,
      },
    });
  }, [query.time, query.id, query.uid, query.type, query.status]);

  const getAlarmDbId = useCallback(() => {
    return api.getAlarmDbId({}).then((res) => {
      setQuery({
        ...query,
        id: res.id,
        uid: res.uid,
        type: res.type,
      });
      reload();
      reloadCount();
    });
  }, []);

  const getAlarmLogsCount = useCallback(async () => {
    if (!query.id || !query.uid || !query.type) {
      return;
    }

    return await api.getAlarmLogsCount({
      query: {
        from: query.time[0].valueOf(),
        to: query.time[1].valueOf(),
        status: query.status || "",
        id: query.id,
        uid: query.uid,
        type: query.type,
      },
    });
  }, [query.time, query.id, query.uid, query.type, query.status]);

  const { data, isLoading, reload } = useAsync({ promiseFn: getAlarmLogs });
  const { isLoading: isAlarmDbIdLoading } = useAsync({ promiseFn: getAlarmDbId });
  const {
    data: alarmLogsCount,
    reload: reloadCount,
    isLoading: isAlarmCountLoading,
  } = useAsync({ promiseFn: getAlarmLogsCount });

  return (
    <div>
      <Head title={t(p("alarmLog"))} />
      <PageTitle titleText={t(p("alarmLog"))} />
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const fieldsValue = await form.validateFields();
            setQuery({
              ...query,
              ...fieldsValue,
            });
          }}
        >
          <Form.Item
            label={
              <Space>
                {t(p("firingTime"))}
                <Popover title={t(p("firingTimePrompt"))}>
                  <QuestionCircleOutlined />
                </Popover>
              </Space>
            }
            name="time"
          >
            <DateTimeRangePicker />
          </Form.Item>
          <Form.Item name="status" label={t(p("status"))}>
            <Select
              placeholder={t(p("status"))}
              options={[
                { value: "", label: t(p("selectAll")) },
                { value: "firing", label: t(p("firing")) },
                { value: "resolved", label: t(p("resolved")) },
              ]}
              style={{ minWidth: "96px" }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t(p("search"))}
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              loading={isAlarmDbIdLoading || isLoading || isAlarmCountLoading}
              onClick={() => {
                reload();
                reloadCount();
              }}
            >
              {t(p("refresh"))}
            </Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <AllAlarmLogsTable
        data={data}
        isLoading={isAlarmDbIdLoading || isLoading || isAlarmCountLoading}
        pagination={{
          current: pageInfo.page,
          pageSize: pageInfo.pageSize,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          showSizeChanger: true,
          total: alarmLogsCount?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
      ></AllAlarmLogsTable>
    </div>
  );
});

export default AlarmLogPage;
