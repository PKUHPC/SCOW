import { Card, Col, Row, Spin, Tabs } from "antd";
import { NextPage } from "next";
import React, { useEffect, useState } from "react";
import { Head } from "src/components/head";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AllowedChipIdType, DeviceCardsData, DevicesMap } from "src/models/device";
import DeviceCard from "src/pageComponents/dashboard/DeviceCard";
import { AppSessionsTable } from "src/pageComponents/jupyter/AppSessionsTable";
import { JobsTable } from "src/pageComponents/quantum/JobsTable";
import { getGateFidelities, mapDeviceStateToDisplayState } from "src/utils/chip";
import { trpc } from "src/utils/trpc";

export const DashboardPage: NextPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("page.dashboard.");
  const pDescription = prefix("pageComp.device.description.");
  const pName = prefix("pageComp.device.name.");


  const { data: recommendedDevices, isLoading, isError, error } = trpc.backend.device.getRecommendedDevices.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  );

  const { data, isLoading: isLoading2, isError: isError2, error: error2 } =
    trpc.backend.device.findDevice.useQuery(
      { id: recommendedDevices, accountName: "_" },
      { enabled: !!recommendedDevices && recommendedDevices.length > 0 },
    );

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

  return (
    <div style={{ minHeight: "100vh" }}>
      <Head title={t(p("title"))} />
      <Card style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, marginTop: -4 }}>{t(p("device"))}</h2>
        <Row gutter={[16, 16]}>
          {
            isLoading || isLoading2 ? (
              <Spin><Localized id="common.loading" /></Spin>
            ) : isError ? (
              <span><Localized id="common.error" />: {error.message}</span>
            ) : isError2 ? (
              <span><Localized id="common.error" />: {error2.message}</span>
            ) : DeviceCardsData.filter((item) => recommendedDevices?.includes(item.id))
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
      <Card>
        <h2 style={{ fontSize: 18 }}>{t(p("recentJob"))}</h2>
        <Tabs
          defaultActiveKey="quantum"
          items={[
            {
              label: t(p("quantum")),
              key: "quantum",
              children: <JobsTable isDashboard={true} />,
            },
            {
              label: "Jupyter",
              key: "jupyter",
              children: <AppSessionsTable isDashboard={true} />,
            },
          ]}
        >
        </Tabs>
      </Card>
    </div>
  );
};

export default DashboardPage;
