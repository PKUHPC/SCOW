"use client";

import { PictureOutlined } from "@ant-design/icons";
import { Avatar, Card, Col, Row, Tooltip } from "antd";
import { join } from "path";
import { useState } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppSchema } from "src/server/trpc/route/jobs/apps";
import { styled } from "styled-components";


const CardContainer = styled.div`
  flex: 1;
  display: flex;
  flex-wrap: wrap;
`;

const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
`;

const NameContainer = styled.div`
  text-align: center;
  margin-top: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;


interface Props {
  publicPath: string;
  basePath: string;
  apps: AppSchema[];
}

type ImageErrorMap = Record<string, boolean>;


export const SelectAppTable: React.FC<Props> = ({ publicPath, apps, basePath }) => {

  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.selectAppTable.");

  const [imageErrorMap, setImageErrorMap] = useState<ImageErrorMap>({});

  const handleImageError = (appId: string) => {
    setImageErrorMap((prevMap) => ({ ...prevMap, [appId]: true }));
  };

  const navigateToApp = (app: AppSchema) => {
    window.location.href = join(basePath,`/jobs/createApp/${app.id}`);
  };

  return (
    <CardContainer>
      <Row gutter={16} style={{ flex: 1, width: "100%" }}>
        {apps.map((app) => (
          <Col xs={24} sm={12} md={8} lg={6} xl={4} xxl={4} key={app.id} style={{ marginBottom: "16px" }}>
            <Card
              style={{ display: "flex", flexDirection: "column", flex: 1, cursor: "pointer" }}
              onClick={() => navigateToApp(app)}
            >
              <Tooltip title={`${t(p("create"))}${app.name}`} placement="bottom">
                <AvatarContainer>
                  {
                    (app.logoPath && imageErrorMap[app.id] !== true) ? (
                      <img
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          objectFit: "contain",
                          width: "150px",
                          height: "150px",
                        }}
                        src={join(publicPath, app.logoPath)}
                        onError={() => handleImageError(app.id)}
                      />
                    ) : (
                      <Avatar
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "0",
                        }}
                        size={150}
                        icon={<PictureOutlined />}
                      />
                    )
                  }
                </AvatarContainer>
                <NameContainer>{app.name}</NameContainer>
              </Tooltip>
            </Card>
          </Col>
        ))}
      </Row>
    </CardContainer>

  );
};
