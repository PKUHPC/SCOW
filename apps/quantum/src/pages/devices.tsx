import { Card, Col, Row, Spin } from "antd";
import { NextPage } from "next";
import React, { useEffect, useMemo,useState } from "react";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AllowedChipIdType, DeviceCardsData, DevicesMap } from "src/models/device";
import DeviceCard from "src/pageComponents/dashboard/DeviceCard";
import { getGateFidelities, mapDeviceStateToDisplayState } from "src/utils/chip";
import { trpc } from "src/utils/trpc";

export const DevicesPage: NextPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("page.dashboard.");
  const pDescription = prefix("pageComp.device.description.");
  const pName = prefix("pageComp.device.name.");

  const { data, isLoading, isError, error } =
    trpc.backend.device.findDevice.useQuery({ accountName: "_" });

  const [devicesMap, setDevicesMap] = useState<Map<AllowedChipIdType, DevicesMap>>(new Map());

  const languageId = useI18n().currentLanguage.id;

  useEffect(() => {
    if (data) {
      const newMap = new Map(data.devices.map((device) => {
        const transformedDevice = {
          ...device,
          gateFidelity: device.Err ? t(pDescription("gateFidelity"), [...getGateFidelities(device.Err)]) : undefined,
          status: device.state ? mapDeviceStateToDisplayState(device.state) : undefined,
        };
        return [device.id, transformedDevice];
      }));
      setDevicesMap(newMap);
    }
  }, [data, languageId]);

  const orderedDeviceCardsData = useMemo(() => {
    const simulatorTcItem = DeviceCardsData.find((item) => item.id === "simulator:tc");
    const otherItems = DeviceCardsData.filter((item) =>
      item.id !== "simulator:tc" && !item.id.includes("t60")); // 屏蔽已下线的芯片

    if (simulatorTcItem) {
      return [...otherItems, simulatorTcItem];
    }
    return otherItems;
  }, [DeviceCardsData]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Card style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, marginTop: -4 }}>{t(p("device"))}</h2>
        <Row gutter={[16, 16]}>
          {
            isLoading ? (
              <Spin><Localized id="common.loading" /></Spin>
            ) : isError ? (
              <span><Localized id="common.error" />: {error.message}</span>
            ) : orderedDeviceCardsData
              .map((item, index) => (
                <Col lg={6} key={index}>
                  <DeviceCard
                    id={item.id}
                    path={item.path}
                    name={t(pName(item.id))}
                    status={ devicesMap.get(item.id)?.status}
                    updateTime={devicesMap.get(item.id)?.at}
                    description={t(pDescription(item.id))}
                    gateFidelity={devicesMap.get(item.id)?.gateFidelity}
                  />
                </Col>
              ))
          }
        </Row>
      </Card>
    </div>
  );
};

export default DevicesPage;
