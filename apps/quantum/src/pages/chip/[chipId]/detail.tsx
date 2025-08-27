import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { Col, Divider, Row, Spin, Typography } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { join } from "path";
import React, { useEffect, useState } from "react";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AllowedChipIdType, allowedChipsArr, DevicesMap } from "src/models/device";
import { getGateFidelities, getReadoutFidelity, mapDeviceStateToDisplayState } from "src/utils/chip";
import { formatTimestamp } from "src/utils/datetime";
import { BASE_PATH } from "src/utils/processEnv";
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
    trpc.backend.device.findDevice.useQuery({ id: [typedChipId], accountName: "_" });

  const [deviceInfo, setDeviceInfo] = useState<DevicesMap | undefined>(undefined);
  const [formattedUpdateTime, setFormattedUpdateTime] = useState<string | undefined>(undefined);
  const [gateFidelities, setGateFidelities] = useState<string[] | undefined>(undefined);
  const [readoutFidelity, setReadoutFidelity] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    if (data && data.devices.length > 0) {
      const device = data.devices[0];

      const gateFidelities = device.Err ? getGateFidelities(device.Err) : undefined;
      setGateFidelities(gateFidelities);

      const readoutFidelity = device.Err ? getReadoutFidelity(device.Err) : undefined;
      setReadoutFidelity(readoutFidelity);

      const newDeviceInfo: DevicesMap = {
        ...device,
        gateFidelity: device.Err
          ? t(pDescription("gateFidelity"), [...gateFidelities!])
          : undefined,
        status: device.state ? mapDeviceStateToDisplayState(device.state) : undefined,
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
            <img
              src={join(BASE_PATH, `/device/basicParam/${typedChipId}.png`)}
              alt="Basic Parameters PHOTO"
              style={{ backgroundColor: "#f8f8fa", maxWidth: "100%", height: "auto", display: "block" }}
            />
          </Col>
          <Col span={7} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
      </Container>
    </>
  );
};

export default ChipDetailPage;
