import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Col, Divider, Radio, Row, Spin, Typography } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { join } from "path";
import React, { useEffect, useMemo, useState } from "react";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { EMPTY_STRING } from "src/models/common";
import {
  AllowedChipIdType, allowedChipsArr, AveragesState, DeviceDetailInfo,
  visualizationChipsArr,
} from "src/models/device";
import { GateFidelityTable } from "src/pageComponents/chip/GateFidelityTable";
import { LayoutVisContainer } from "src/pageComponents/chip/LayoutVisContainer";
import { VisualizationContainer } from "src/pageComponents/chip/VisualizationContainer";
import { calculateAverage, getGateFidelities, getReadoutFidelity } from "src/utils/chip";
import { formatTimestamp } from "src/utils/datetime";
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

const { Text } = Typography;

export const ChipDetailPage: NextPage = () => {
  const router = useRouter();
  const chipId = queryToString(router.query.chipId);

  const getOffsetDegreeQuery = trpc.config.getOffsetDegree.useQuery({ chipId });

  const offsetDegree = useMemo(() =>
    getOffsetDegreeQuery.data?.offsetDegree || 0
  , [getOffsetDegreeQuery.data]);

  if (!(allowedChipsArr as readonly string[]).includes(chipId)) {
    return <>Chip not found.</>;
  }

  if (chipId === "simulator:tc") {
    return <>Simulator:tc is not supported detail page yet.</>;
  }

  const languageId = useI18n().currentLanguage.id;
  const typedChipId = chipId as AllowedChipIdType;

  const t = useI18nTranslateToString();
  const p = prefix("page.chip.");
  const pName = prefix("pageComp.device.name.");
  const pDescription = prefix("pageComp.device.description.");

  const { data, isLoading, isError, error } =
    trpc.backend.device.getDeviceDetail.useQuery({ id: typedChipId, accountName: "_" });

  const [deviceInfo, setDeviceInfo] = useState<DeviceDetailInfo | undefined>(undefined);
  const [formattedUpdateTime, setFormattedUpdateTime] = useState<string | undefined>(undefined);
  const [gateFidelities, setGateFidelities] = useState<string[] | undefined>(undefined);
  const [readoutFidelity, setReadoutFidelity] = useState<string[] | undefined>(undefined);

  // 该芯片是否支持可视化
  const hasVisualization = visualizationChipsArr.includes(typedChipId);
  const [activeTabShowType, setActiveTabShowType] = useState<"chart" | "data">(
    hasVisualization ? "chart" : "data",
  );

  const [averages, setAverages] = useState<AveragesState>({
    t1Avg: EMPTY_STRING,
    t2Avg: EMPTY_STRING,
    sqErrAvg: EMPTY_STRING,
    f0ErrAvg: EMPTY_STRING,
    f1ErrAvg: EMPTY_STRING,
    czErrAvg: EMPTY_STRING,
  });

  useEffect(() => {
    if (data) {
      const device = data.device;

      const gateFidelities = device.Err ? getGateFidelities(device.Err) : undefined;
      setGateFidelities(gateFidelities);

      const readoutFidelity = device.Err ? getReadoutFidelity(device.Err) : undefined;
      setReadoutFidelity(readoutFidelity);

      const newDeviceInfo: DeviceDetailInfo = {
        ...device,
        gateFidelity: device.Err
          ? t(pDescription("gateFidelity"), [...gateFidelities!])
          : undefined,
      };

      setDeviceInfo(newDeviceInfo);

      const newFormattedTime = newDeviceInfo?.at
        ? formatTimestamp(newDeviceInfo.at)
        : undefined;
      setFormattedUpdateTime(newFormattedTime);
    } else {
      setDeviceInfo(undefined);
      setFormattedUpdateTime(undefined);
    }
  }, [data, languageId]);

  useEffect(() => {

    const t1Avg = deviceInfo?.bits
      ? calculateAverage(deviceInfo.bits.map((bit) => bit.T1), 1)
      : EMPTY_STRING;
    const t2Avg = deviceInfo?.bits
      ? calculateAverage(deviceInfo.bits.map((bit) => bit.T2), 1)
      : EMPTY_STRING;
    const sqErrAvg = deviceInfo?.bits
      ? calculateAverage(deviceInfo.bits.map((bit) => bit.SingleQubitErrRate), 5)
      : EMPTY_STRING;
    const f0ErrAvg = deviceInfo?.bits
      ? calculateAverage(deviceInfo.bits.map((bit) => bit.ReadoutF0Err), 5)
      : EMPTY_STRING;
    const f1ErrAvg = deviceInfo?.bits
      ? calculateAverage(deviceInfo.bits.map((bit) => bit.ReadoutF1Err), 5)
      : EMPTY_STRING;

    const czErrAvg = deviceInfo?.links
      ? calculateAverage(deviceInfo.links.map((link) => link.CZErrRate).filter((x) => x !== undefined), 3)
      : EMPTY_STRING;

    setAverages({
      t1Avg,
      t2Avg,
      sqErrAvg,
      f0ErrAvg,
      f1ErrAvg,
      czErrAvg,
    });

  }, [deviceInfo]);

  if (getOffsetDegreeQuery.isLoading) {
    return (
      <div>Loading...</div>
    );
  }

  return (
    <>
      <Container>
        <a
          onClick={() => {
            router.push(join("/devices"));
          }}
        >
          &lt; {t(p("back"))}
        </a>
        <Divider type="vertical" />
        <span>{t(pName(typedChipId))}</span>

        <div style={{ margin: "12px 0 -12px 0" }}>{t(p("info"))}</div>
        <Divider />

        {isLoading ? (
          <Spin>
            <Localized id="common.loading" />
          </Spin>
        ) : isError ? (
          <span>
            <Localized id="common.error" />: {error.message}
          </span>
        ) : (
          <>
            <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
              {t(pDescription(typedChipId))}
            </Text>
            {deviceInfo?.gateFidelity && (
              <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
                {deviceInfo?.gateFidelity}
              </Text>
            )}
            {formattedUpdateTime && (
              <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
                {t(p("updateTime"))}: {formattedUpdateTime}
              </Text>
            )}
          </>
        )}

        <div style={{ margin: "24px 0 -12px 0" }}>{t(p("basicParam"))}</div>
        <Divider />

        <Row gutter={16} style={{ backgroundColor: "#f8f8fa", alignItems: "stretch" }}>
          <Col span={12} style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "12px 0" }}>
            <LayoutVisContainer deviceInfo={deviceInfo} offsetDegree={offsetDegree} />
          </Col>
          <Col
            span={7}
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", margin: "12px 0" }}
          >
            <div>
              <Row style={{ marginBottom: 12 }}>
                <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                  <Text>{t(p("nativeGateSet"))} :</Text>
                </Col>
                <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                  <Text style={{ color: "#0D6EFD" }}>
                    {"H, X, X/2,"}
                    <br />
                    {"Y, Y/2, Z,"}
                    <br />
                    {"CZ"}
                  </Text>
                </Col>
              </Row>
              {deviceInfo?.T1 && (
                <Row style={{ marginBottom: 12 }}>
                  <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                    <Text>{t(p("t1Average"))} :</Text>
                  </Col>
                  <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                    <Text style={{ color: "#0D6EFD" }}>{deviceInfo.T1.toFixed(1) + "μs"}</Text>
                  </Col>
                </Row>
              )}
              {deviceInfo?.T2 && (
                <Row style={{ marginBottom: 12 }}>
                  <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                    <Text>{t(p("t2Average"))} :</Text>
                  </Col>
                  <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                    <Text style={{ color: "#0D6EFD" }}>{deviceInfo.T2.toFixed(1) + "μs"}</Text>
                  </Col>
                </Row>
              )}
              {
                gateFidelities?.[0] && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                      <Text>{t(p("SQGateFidelity"))} :</Text>
                    </Col>
                    <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                      <Text style={{ color: "#0D6EFD" }}>{gateFidelities[0]}</Text>
                    </Col>
                  </Row>
                )
              }
              {
                gateFidelities?.[1] && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                      <Text>{t(p("CZGateFidelity"))} :</Text>
                    </Col>
                    <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                      <Text style={{ color: "#0D6EFD" }}>{gateFidelities[1]}</Text>
                    </Col>
                  </Row>
                )
              }
              {
                readoutFidelity && (
                  <Row style={{ marginBottom: 12 }}>
                    <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                      <Text>{t(p("readoutFidelity"))} :</Text>
                    </Col>
                    <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                      <Text style={{ color: "#0D6EFD" }}>
                        F0: {readoutFidelity[0]}<br />F1: {readoutFidelity[1]}
                      </Text>
                    </Col>
                  </Row>
                )
              }
              <Row style={{ marginBottom: 12 }}>
                <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                  <Text>{t(p("shotsLimit"))} :</Text>
                </Col>
                <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                  <Text style={{ color: "#0D6EFD" }}>≤ 10000</Text>
                </Col>
              </Row>
              <Row>
                <Col span={13} style={{ textAlign: "right", paddingRight: 8 }}>
                  <Text>{t(p("recoCircuitDepth"))} :</Text>
                </Col>
                <Col span={11} style={{ textAlign: "left", paddingLeft: 8 }}>
                  <Text style={{ color: "#0D6EFD" }}>≤ 15</Text>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>

        <Row justify="space-between" style={{ margin: "24px 0 -12px 0" }} align="middle">
          <Col>
            <div>{t(p("gateFidelity"))}</div>
          </Col>
          <Col>
            {
              hasVisualization && (
                <Radio.Group
                  defaultValue="chart"
                  buttonStyle="solid"
                  onChange={(e) => setActiveTabShowType(e.target.value)}
                >
                  <Radio.Button value="chart">{t(p("chart"))}</Radio.Button>
                  <Radio.Button value="data">{t(p("data"))}</Radio.Button>
                </Radio.Group>
              )
            }
          </Col>
        </Row>
        <Divider />
        <Row gutter={16}>
          <Col span={24}>
            {activeTabShowType === "chart" ? (
              <VisualizationContainer deviceInfo={deviceInfo} offsetDegree={offsetDegree} />
            ) : (
              <GateFidelityTable deviceInfo={deviceInfo} averages={averages} />
            )}
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default ChipDetailPage;
