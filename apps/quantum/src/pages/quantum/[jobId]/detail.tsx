import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Col, Descriptions, DescriptionsProps, Divider, Radio, Row, Tabs } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { join } from "path";
import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PieLabelRenderProps, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { EMPTY_STRING } from "src/models/common";
import { formatDateTime, formatTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

const Container = styled.div`
  padding: 20px;
  margin: 8px 0;
  background: ${({ theme }) => theme.token.colorBgElevated};
  border: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.token.borderRadius}px;

  .ant-descriptions-item-label {
    width: 150px !important;
    display: inline-block;
  }
`;

// const TabContentContainer = styled.div`
//   margin-top: 20px;
// `;

// 新增样式：用于右对齐图表和按钮的容器
const RightAlignedContainer = styled.div`
  flex-direction: column;
  display: flex;
  align-items: flex-end;
  width: 100%;
`;

// 极坐标图表容器
const PolarChartContainer = styled.div`
  width: 400px;
  height: 400px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// 中心标签样式
const CenterLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
  background: black;
  color: white;
  border-radius: 50%;
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  opacity: 0.2;
`;

export const JobDetailPage: NextPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("page.quantum.");

  const router = useRouter();

  const jobId = queryToString(router.query.jobId);

  const { data } = trpc.backend.task.getTaskDetail.useQuery({ id: jobId, accountName: "_" });

  const [activeTabShowType, setActiveTabShowType] = useState<string>("chart");
  // const [activeTabOrientation , setActiveTabOrientation] = useState<string>("horizontal");

  const formattedInputData = useMemo(() => {
    if (!data?.task) {
      return "";
    }
    return data.task.source;
  }, [data]);


  const formattedOutputData = useMemo(() => {
    if (!data?.task) {
      return "";
    }
    const result = data.task.result;
    if (typeof result === "object" && result !== null) {
      // 将对象格式化为多行字符串
      return Object.entries(result)
        .map(([key, value]) => `"${key}": ${String(value)}`)
        .join("\n");
    }
    return result ?? "";
  }, [data]);

  // 动态生成图表数据
  const chartData = useMemo(() => {
    if (!data?.task || typeof data.task.result !== "object" || !formattedOutputData) {
      return [];
    }

    const entries = Object.entries(data.task.result);
    const total = entries.reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);

    // 生成频率分布
    return entries.map(([key, value]) => ({
      name: key,
      frequency: value / total,
      value: value / total, // 为PieChart添加value字段
    })).sort((a, b) => parseInt(a.name, 2) - parseInt(b.name, 2));
  }, [data, formattedOutputData]);


  const formattedOptimizationData = useMemo(() => {
    // 检查 optimization 是否存在
    if (!data?.task?.optimization) {
      return "";
    }

    // 获取 optimization 对象
    const optimization = data.task.optimization;

    // 1. 查找 lang 为 "tqasm" 的 progs 对象
    const tqasmProg = optimization.progs?.find((prog) =>
      prog?.lang?.toLowerCase() === "tqasm",
    );

    // 2. 如果找到 tqasm 代码，返回其内容
    if (tqasmProg?.code) {
      return tqasmProg.code;
    }

    // 3. 否则返回空字符串
    return "";
  }, [data]);

  // 定义颜色
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    name,
  }: PieLabelRenderProps & { name?: string }) => {
    // 类型守卫和默认值处理
    if (
      cx === undefined ||
      cy === undefined ||
      midAngle === undefined ||
      innerRadius === undefined ||
      outerRadius === undefined
    ) {
      return null;
    }

    // 确保所有值都是数字类型
    const numCx = typeof cx === "string" ? parseFloat(cx) : cx;
    const numCy = typeof cy === "string" ? parseFloat(cy) : cy;
    const numMidAngle = typeof midAngle === "string" ? parseFloat(midAngle) : midAngle;
    const numInnerRadius = typeof innerRadius === "string" ? parseFloat(innerRadius) : innerRadius;
    const numOuterRadius = typeof outerRadius === "string" ? parseFloat(outerRadius) : outerRadius;

    // 检查转换后的值是否有效
    if (
      isNaN(numCx) ||
      isNaN(numCy) ||
      isNaN(numMidAngle) ||
      isNaN(numInnerRadius) ||
      isNaN(numOuterRadius)
    ) {
      return null;
    }

    const RADIAN = Math.PI / 180;
    const radius = numInnerRadius + (numOuterRadius - numInnerRadius) * 1.2;
    const x = numCx + radius * Math.cos(-numMidAngle * RADIAN);
    const y = numCy + radius * Math.sin(-numMidAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#333"
        textAnchor={x > numCx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold"
      >
        {name}
      </text>
    );
  };


  const descriptionItems: DescriptionsProps["items"] = [
    {
      key: "1",
      label: t(p("quantumId")),
      children: data?.task?.id ?? EMPTY_STRING,
    },
    {
      key: "2",
      label: t(p("jobName")),
      children: data?.task?.name ?? EMPTY_STRING,
    },
    {
      key: "3",
      label: t(p("device")),
      children: data?.task?.device
        ? (data.task.device.includes("?o=")
          ? data.task.device.split("?o=")[0]
          : data.task.device)
        : EMPTY_STRING,
    },
    {
      key: "4",
      label: "Qubits",
      children: data?.task?.qubits ?? EMPTY_STRING,
    },
    {
      key: "5",
      label: "Shots",
      children: data?.task?.shots ?? EMPTY_STRING,
    },
    {
      key: "6",
      label: t(p("state")),
      children: data?.task?.state ?? EMPTY_STRING,
    },
    {
      key: "7",
      label: t(p("md5")),
      children: data?.task?.md5 ?? EMPTY_STRING,
    },
    {
      key: "8",
      label: t(p("submitTime")),
      span: 2,
      children: data?.task?.submitTime ? formatDateTime(data.task.submitTime) : EMPTY_STRING,
    },
    {
      key: "9",
      label: t(p("runDur")),
      span: 2,
      children: data?.task.duration ? formatTime(data.task.duration) : EMPTY_STRING,
    },
    {
      key: "10",
      label: t(p("qosOptions")),
      children: (() => {
        const device = data?.task?.device;
        if (typeof device === "string" && device.includes("?o=")) {
          const oValueStr = device.split("?o=")[1];
          const oValue = Number(oValueStr);
          if (!isNaN(oValue) && oValue >= 0 && oValue <= 7) {
            const validOValue = oValue as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
            return t(p(`qosMap${validOValue}`));
          }
        }
        return EMPTY_STRING;
      })(),
    },
  ];

  return (
    <>
      <Container>
        <a
          style={{ fontWeight: 600 }}
          onClick={() => {
            router.push(join("/quantum/list"));
          }}
        >
          &lt; {t(p("back"))}
        </a>
        <Divider type="vertical" />
        <span style={{ fontWeight: 600 }}>{t(p("jobDetail"))}</span>

        <div style={{ margin: "12px 0 -12px 0" }}>{t(p("jobInfo"))}</div>
        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            {/* 左边区域：作业名及详细参数 */}
            <Row gutter={16}>
              <Col span={24}>
                {/* 详细描述区域 */}
                <Descriptions
                  column={1}
                  size="middle"
                  items={descriptionItems}
                />

              </Col>
            </Row>
          </Col>
          <Col span={12}>
            {/* 右边区域：图像或数据 + 切换按钮 */}
            <Row gutter={16} style={{ height: "100%" }}>
              <Col span={18} style={{ display: "flex", justifyContent: "flex-end" }}>
                {/* 右对齐内容包裹器 */}
                <RightAlignedContainer>
                  {activeTabShowType === "chart" ? (
                    <PolarChartContainer>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={120}
                            innerRadius={40}
                            fill="#8884d8"
                            dataKey="value"
                            startAngle={90}
                            endAngle={450}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name) => [
                              `${(value * 100).toFixed(2)}%`,
                              `${name}`,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <CenterLabel>
                        <div>2</div>
                        <div style={{ fontSize: "12px", fontWeight: "normal" }}>qubits</div>
                      </CenterLabel>
                    </PolarChartContainer>
                  ) : (
                    <div>
                      <div>
                        {/* 图表展示（设置背景色） */}
                        <BarChart
                          width={600}
                          height={300}
                          data={chartData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="frequency" fill="#8884d8" />
                        </BarChart>
                      </div>
                    </div>
                  )}
                </RightAlignedContainer>
              </Col>
              <Col span={6} style={{ display: "flex", justifyContent: "flex-end" }}>
                <Radio.Group
                  defaultValue="chart"
                  buttonStyle="solid"
                  onChange={(e) => setActiveTabShowType(e.target.value)}
                >
                  <Radio.Button value="chart">{t(p("chart"))}</Radio.Button>
                  <Radio.Button value="data">{t(p("data"))}</Radio.Button>
                </Radio.Group>
              </Col>
            </Row>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Tabs defaultActiveKey="1">
              <Tabs.TabPane tab={t(p("inputCircuit"))} key="1">
                <pre>{formattedInputData}</pre>
              </Tabs.TabPane>
              {
                formattedOptimizationData.length > 0 && (
                  <Tabs.TabPane tab={t(p("compiledCircuit"))} key="2">
                    <pre>{formattedOptimizationData}</pre>
                  </Tabs.TabPane>
                )
              }
              {
                formattedOutputData.length > 0 && (
                  <Tabs.TabPane tab={t(p("outputData"))} key="3">
                    <pre>{formattedOutputData}</pre>
                  </Tabs.TabPane>
                )
              }
            </Tabs>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default JobDetailPage;
