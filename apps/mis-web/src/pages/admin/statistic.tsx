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

import { MoneyCollectOutlined, PlayCircleOutlined, ProjectOutlined,
  TeamOutlined, UserOutlined, WalletOutlined } from "@ant-design/icons";
import { moneyToNumber } from "@scow/lib-decimal";
import { getDefaultPresets } from "@scow/lib-web/build/utils/datetime";
import { Card, Col, DatePicker, Row, Space } from "antd";
import dayjs from "dayjs";
import { NextPage } from "next";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getOperationTypeTexts } from "src/models/operationLog";
import { PlatformRole, SearchType } from "src/models/User";
import { DataBarChart } from "src/pageComponents/admin/DataBarChart";
import { DataLineChart } from "src/pageComponents/admin/DataLineChart";
import { StatisticCard } from "src/pageComponents/admin/StatisticCard";
import { publicConfig } from "src/utils/config";
import { dateMessageToDayjs } from "src/utils/date";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const p = prefix("page.admin.statistic.");

const formateData = (data: {
  date: { year: number, month: number, day: number },
  count: number
}[], dateRange: [dayjs.Dayjs, dayjs.Dayjs]) => {
  const input = data.map((d) => ({
    date: dateMessageToDayjs(d.date),
    count: d.count,
  }));
  const countData: { date: dayjs.Dayjs, count: number }[] = [];
  const [startDate, endDate] = dateRange;
  const days = endDate.diff(startDate, "day") + 1;
  let curDate = startDate.clone();
  for (let i = 0; i < days; i++) {
    const v = input?.find((x) => {
      return curDate.isSame(x.date, "day");
    });
    if (v) {
      countData[i] = {
        date: curDate.clone(),
        count: v.count,
      };
    } else {
      countData[i] = {
        date: curDate.clone(),
        count: 0,
      };
    }
    curDate = curDate.add(1, "day");
  }
  return countData;
};

const TitleText = styled.span`
  font-size: 24px;
  font-weight: bold;
`;

export const PlatformStatisticsPage: NextPage = requireAuth(
  (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const OperationTypeTexts = getOperationTypeTexts(t);

  const today = dayjs().endOf("day");
  const [query, setQuery] = useState<{ filterTime: [dayjs.Dayjs, dayjs.Dayjs], }>({
    filterTime: [today.clone().subtract(7, "day"), today],
  });

  const getStatisticInfoFn = useCallback(async () => {
    return await api.getStatisticInfo({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: statisticInfo, isLoading: statisticInfoLoading } = useAsync({ promiseFn: getStatisticInfoFn });

  const getJobTotalCountFn = useCallback(async () => {
    return await api.getJobTotalCount({});
  }, []);

  const { data: jobTotalCount, isLoading: jobTotalCountLoading } = useAsync({ promiseFn: getJobTotalCountFn });


  const getChargeTotalAmountFn = useCallback(async () => {
    return await api.getChargeRecordsTotalCount({
      query: {
        startTime: new Date(0).toISOString(),
        endTime: new Date().toISOString(),
        isPlatformRecords: true,
        searchType: SearchType.ACCOUNT,
      },
    });
  }, []);

  const { data: totalCharge, isLoading: totalChargeAmountLoading } =
    useAsync({ promiseFn: getChargeTotalAmountFn });

  const getNewUserCountFn = useCallback(async () => {
    return await api.getNewUserCount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
      timeZone,
    } });
  }, [query]);

  const { data: newUserCount, isLoading: newUserLoading } = useAsync({ promiseFn: getNewUserCountFn });

  const getActiveUserCountFn = useCallback(async () => {
    return await api.getActiveUserCount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
      timeZone,
    } });
  }, [query]);

  const { data: activeUserCount, isLoading: activeUserLoading } = useAsync({ promiseFn: getActiveUserCountFn });

  const getTopChargeAccountFn = useCallback(async () => {
    return await api.getTopChargeAccount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: topChargeAccount, isLoading: topChargeAccountLoading } = useAsync({ promiseFn: getTopChargeAccountFn });

  const getTopPayAccountFn = useCallback(async () => {
    return await api.getTopPayAccount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: topPayAccount, isLoading: topPayAccountLoading } = useAsync({ promiseFn: getTopPayAccountFn });

  const getDailyChargeFn = useCallback(async () => {
    return await api.getDailyCharge({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
      timeZone,
    } });
  }, [query]);

  const { data: dailyCharge, isLoading: dailyChargeLoading } = useAsync({ promiseFn: getDailyChargeFn });

  const getDailyPayFn = useCallback(async () => {
    return await api.getDailyPay({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
      timeZone,
    } });
  }, [query]);

  const { data: dailyPay, isLoading: dailyPayLoading } = useAsync({ promiseFn: getDailyPayFn });

  // const getTopSubmitJobUserFn = useCallback(async () => {
  //   return await api.getTopSubmitJobUser({ query: {
  //     startTime: query.filterTime[0].startOf("day").toISOString(),
  //     endTime: query.filterTime[1].endOf("day").toISOString(),
  //   } });
  // }, [query]);

  // const { data: topSubmitJobUser, isLoading: topSubmitJobUserLoading } =
  // useAsync({ promiseFn: getTopSubmitJobUserFn });

  const getUsersWithMostJobSubmissionsFn = useCallback(async () => {
    return await api.getUsersWithMostJobSubmissions({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: topSubmitJobUser, isLoading: topSubmitJobUserLoading } =
  useAsync({ promiseFn: getUsersWithMostJobSubmissionsFn });

  const getNewJobCountFn = useCallback(async () => {
    return await api.getNewJobCount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
      timeZone,
    } });
  }, [query]);

  const { data: dailyNewJobCount, isLoading: dailyNewJobCountLoading } = useAsync({ promiseFn: getNewJobCountFn });


  const getPortalUsageCountFn = useCallback(async () => {
    return await api.getPortalUsageCount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: portalUsageCount, isLoading: portalUsageCountLoading } = useAsync({ promiseFn: getPortalUsageCountFn });

  const getMisUsageCountFn = useCallback(async () => {
    return await api.getMisUsageCount({ query: {
      startTime: query.filterTime[0].startOf("day").toISOString(),
      endTime: query.filterTime[1].endOf("day").toISOString(),
    } });
  }, [query]);

  const { data: misUsageCount, isLoading: misUsageCountLoading } = useAsync({ promiseFn: getMisUsageCountFn });

  const newUserCountData = useMemo(() => {
    if (newUserCount) {
      return formateData(newUserCount?.results, query.filterTime);
    }
    return [];
  }, [query, newUserCount]);

  const activeUserCountData = useMemo(() => {

    if (activeUserCount) {
      return formateData(activeUserCount?.results, query.filterTime);
    }
    return [];
  }, [query, activeUserCount]);


  const topChargeAccountData = useMemo(() => {

    return topChargeAccount?.results.map((r) => ({
      x: r.userName,
      y: moneyToNumber(r.chargedAmount).toFixed(publicConfig.CHARGE_PRECISION),
    })) || [];
  }, [query, topChargeAccount]);

  const topPayAccountData = useMemo(() => {

    return topPayAccount?.results.map((r) => ({
      x: r.userName,
      y: moneyToNumber(r.payAmount).toFixed(publicConfig.CHARGE_PRECISION),
    })) || [];
  }, [query, topPayAccount]);

  const dailyChargeData = useMemo(() => {
    if (dailyCharge) {
      return formateData(dailyCharge?.results
        .map((d) => ({ date: d.date, count: moneyToNumber(d.amount) })), query.filterTime);
    }
    return [];
  }, [query, dailyCharge]);

  const dailyPayData = useMemo(() => {
    if (dailyPay) {
      return formateData(dailyPay?.results
        .map((d) => ({ date: d.date, count: moneyToNumber(d.amount) })), query.filterTime);
    }
    return [];
  }, [query, dailyPay]);

  const topSubmitJobUserData = useMemo(() => {

    return topSubmitJobUser?.results.map((r) => ({
      x: r.userName,
      y: r.count,
    })) || [];
  }, [query, topSubmitJobUser]);

  const newJobCountData = useMemo(() => {
    if (dailyNewJobCount) {
      return formateData(dailyNewJobCount?.results, query.filterTime);
    }
    return [];
  }, [query, dailyNewJobCount]);

  const totalNewJobCount = useMemo(() => {
    if (dailyNewJobCount) {
      return dailyNewJobCount?.results.reduce((pre, cur) => pre + cur.count, 0);
    }
    return 0;
  }, [dailyNewJobCount]);

  const totalNewChargeAmount = useMemo(() => {
    if (dailyCharge) {
      return dailyCharge?.results.reduce((pre, cur) => pre + moneyToNumber(cur.amount), 0);
    }
    return 0;
  }, [dailyCharge]);

  const portalUsageCountData = useMemo(() => {
    if (portalUsageCount) {
      return portalUsageCount.results;
    }
    return [];
  }, [query, portalUsageCount]);

  const misUsageCountData = useMemo(() => {
    if (misUsageCount) {
      return misUsageCount.results;
    }
    return [];
  }, [query, misUsageCount]);

  const amountToolTipFormatter = (value: number) => [`${value.toLocaleString()}(${t(p("yuan"))})`, t(p("amount"))];

  return (
    <>
      <Head title={t("layouts.route.common.statistic")} />
      <PageTitle titleText={t(p("dataOverview"))} />
      <Row gutter={[16, 16]}>
        <Col span={24} style={{ textAlign: "right" }}>
          <span>{t(p("dateRange"))}：</span>
          <DatePicker.RangePicker
            allowClear={false}
            presets={getDefaultPresets(languageId)}
            defaultValue={[query.filterTime?.[0], query.filterTime?.[1]]}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setQuery({ filterTime: [dates[0], dates[1]]});
              }
            }}
          />
        </Col>
        <Col flex={4}>
          <StatisticCard
            title={t(p("user"))}
            newAddValue={statisticInfo?.newUser}
            totalValue={statisticInfo?.totalUser}
            loading={statisticInfoLoading}
            icon={UserOutlined}
            iconColor="#94070A"
          />
        </Col>
        <Col flex={4}>
          <StatisticCard
            title={t(p("account"))}
            newAddValue={statisticInfo?.newAccount}
            totalValue={statisticInfo?.totalAccount}
            loading={statisticInfoLoading}
            icon={WalletOutlined}
            iconColor="#2e86de"
          />
        </Col>
        <Col flex={4}>
          <StatisticCard
            title={t(p("tenant"))}
            newAddValue={statisticInfo?.newTenant}
            totalValue={statisticInfo?.totalTenant}
            loading={statisticInfoLoading}
            icon={TeamOutlined}
            iconColor="#1dd1a1"
          />
        </Col>
        <Col flex={4}>
          <StatisticCard
            title={t(p("job"))}
            newAddValue={totalNewJobCount}
            totalValue={jobTotalCount?.count}
            loading={jobTotalCountLoading || dailyNewJobCountLoading}
            icon={ProjectOutlined}
            iconColor="#8395a7"
          />
        </Col>
        <Col flex={4}>
          <StatisticCard
            title={t(p("charge"))}
            newAddValue={totalNewChargeAmount.toLocaleString()}
            totalValue={totalCharge?.totalAmount.toLocaleString()}
            loading={totalChargeAmountLoading || dailyChargeLoading}
            icon={MoneyCollectOutlined}
            iconColor="#feca57"
            precision={2}
          />
        </Col>
        <Col span={24}>
          <Card
            title={(
              <Space align="baseline">
                <UserOutlined style={{ fontSize: "24px", color: "#94070A" }} />
                <TitleText>{t(p("userCount"))}</TitleText>
              </Space>
            )}
            bordered={false}
          >
            <Row>
              <Col span={12}>
                <DataLineChart
                  data={
                    newUserCountData.map((d) => ({
                      x: d.date.format("YYYY-MM-DD"),
                      y: d.count,
                    }))}
                  isLoading={newUserLoading}
                  title={t(p("newUserCount"))}
                  toolTipFormatter={(value) => [value, t(p("userCount"))]}
                ></DataLineChart>
              </Col>
              <Col span={12}>
                <DataLineChart
                  data={activeUserCountData.map((d) => ({
                    x: d.date.format("YYYY-MM-DD"),
                    y: d.count,
                  }))}
                  title={t(p("activeUserCount"))}
                  toolTipFormatter={(value) => [value, t(p("userCount"))]}
                  isLoading={activeUserLoading}
                ></DataLineChart>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            title={(
              <Space align="baseline">
                <MoneyCollectOutlined style={{ fontSize: "24px", color: "#feca57" }} />
                <TitleText>{t(p("chargeOrPayAmount"))}</TitleText>
              </Space>
            )}
            bordered={false}
          >
            <Row>
              <Col xs={24} md={24} lg={12}>
                <DataBarChart
                  data={topChargeAccountData}
                  title={t(p("topTenChargedAccount"))}
                  isLoading={topChargeAccountLoading}
                  xLabel={t(p("userName"))}
                  toolTipFormatter={amountToolTipFormatter}
                />
              </Col>
              <Col xs={24} md={24} lg={12}>
                <DataLineChart
                  data={dailyChargeData.map((d) => ({
                    x: d.date.format("YYYY-MM-DD"),
                    y: Number(d.count.toFixed(publicConfig.CHARGE_PRECISION)),
                  }))}
                  title={t(p("chargeAmount"))}
                  isLoading={dailyChargeLoading}
                  toolTipFormatter={amountToolTipFormatter}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={24} md={24} lg={12}>
                <DataBarChart
                  data={topPayAccountData}
                  title={t(p("topTenPayAccount"))}
                  isLoading={topPayAccountLoading}
                  xLabel={t(p("userName"))}
                  toolTipFormatter={amountToolTipFormatter}
                />
              </Col>
              <Col xs={24} md={24} lg={12}>
                <DataLineChart
                  data={dailyPayData.map((d) => ({
                    x: d.date.format("YYYY-MM-DD"),
                    y: Number(d.count.toFixed(publicConfig.CHARGE_PRECISION)),
                  }))}
                  title={t(p("payAmount"))}
                  toolTipFormatter={amountToolTipFormatter}
                  isLoading={dailyPayLoading}
                />
              </Col>
            </Row>
          </Card>
        </Col>


        <Col span={24}>
          <Card
            title={(
              <Space align="baseline">
                <ProjectOutlined style={{ fontSize: "24px", color: "#8395a7" }} />
                <TitleText>{t(p("job"))}</TitleText>
              </Space>
            )}
            bordered={false}
          >
            <Row>
              <Col xs={24} md={24} lg={12}>
                <DataBarChart
                  data={topSubmitJobUserData}
                  title={t(p("topTenSubmitJobUser"))}
                  isLoading={topSubmitJobUserLoading}
                  xLabel={t(p("userName"))}
                  toolTipFormatter={(value) => [value, t(p("jobCount"))]}
                />
              </Col>
              <Col xs={24} md={24} lg={12}>
                <DataLineChart
                  data={newJobCountData.map((d) => ({
                    x: d.date.format("YYYY-MM-DD"),
                    y: d.count,
                  }))}
                  title={t(p("newJobCount"))}
                  toolTipFormatter={(value) => [value, t(p("jobCount"))]}
                  isLoading={dailyNewJobCountLoading}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            title={(
              <Space align="baseline">
                <PlayCircleOutlined style={{ fontSize: "24px", color: "black" }} />
                <TitleText>{t(p("systemFeatureUsageCount"))}</TitleText>
              </Space>
            )}
            bordered={false}
          >
            <Row>
              <Col xs={24} md={24} lg={12}>
                <DataBarChart
                  data={portalUsageCountData.slice(0, 10).map((d) => ({
                    x: OperationTypeTexts[d.operationType],
                    y: d.count,
                  }))}
                  title={t(p("topTenPortalFeatureUsageCount"))}
                  toolTipFormatter={(value) => [value, t(p("usageCount"))]}
                  isLoading={portalUsageCountLoading}
                />
              </Col>
              <Col xs={24} md={24} lg={12}>
                <DataBarChart
                  data={misUsageCountData.slice(0, 10).map((d) => ({
                    x: OperationTypeTexts[d.operationType],
                    y: d.count,
                  }))}
                  title={t(p("topTenMisFeatureUsageCount"))}
                  toolTipFormatter={(value) => [value, t(p("usageCount"))]}
                  isLoading={misUsageCountLoading}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </>
  );
});


export default PlatformStatisticsPage;
