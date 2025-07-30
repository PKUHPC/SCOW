import { PictureOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Col, Form, Input, message, Row, Space, Spin, Tooltip } from "antd";
import Link from "next/link";
import { join } from "path";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";
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

interface FilterForm {
  appName: string | undefined;
}

interface Props {
  clusterId: string;
}

type ImageErrorMap = Record<string, boolean>;

const p = prefix("pageComp.app.createApps.");

export const CreateAppsTable: React.FC<Props> = ({ clusterId }) => {

  const t = useI18nTranslateToString();

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    appName: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);

  const { data, isLoading } = useAsync({ promiseFn: useCallback(async () => {
    return await api.listAvailableApps({ query: { cluster: clusterId } })
      .httpError(500, (e) => {
        if (e.code === "APP_CONFIG_ERROR") {
          message.error(e.error);
        } else {
          throw e;
        }
      });
  }, [clusterId]) });

  const [imageErrorMap, setImageErrorMap] = useState<ImageErrorMap>({});

  const handleImageError = (appId: string) => {
    setImageErrorMap((prevMap) => ({ ...prevMap, [appId]: true }));
  };

  // 前端过滤查询结果
  const filteredData = useMemo(() => {

    if (!data) return undefined;
    if (!query.appName) {
      return data;
    }
    const filteredValues = data.apps
      .filter((app) => app.name.toLowerCase().includes(query.appName?.toLowerCase() || ""));
    return { apps: filteredValues };

  }, [data, query]);

  useEffect(() => {
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  }, [clusterId, filterForm]);

  return (
    <Spin spinning={isLoading} tip={isLoading ? t(p("loading")) : ""} style={{ marginTop: "150px" }}>
      <Space style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end" }}>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={initialFilterQuery}
          onFinish={async () => {
            const { appName } = await filterForm.validateFields();
            setQuery({ appName: appName === "" ? undefined : appName?.trim() });
          }}
        >
          <Form.Item name="appName">
            <Input allowClear placeholder={t(p("searchPlaceholder"))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t("button.searchButton")}
            </Button>
          </Form.Item>
        </Form>
      </Space>
      <>
        {!isLoading && filteredData?.apps.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "100px", fontSize: "16px" }}>
            {query.appName ? t(p("noSearchResult"), [query.appName]) : t(p("notFoundMessage"))}
          </div>
        ) : (
          <CardContainer>
            <Row gutter={16} style={{ flex: 1, width: "100%" }}>
              {filteredData?.apps.map((app) => (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} xxl={4} key={app.id} style={{ marginBottom: "16px" }}>
                  <Card bodyStyle={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <Tooltip title={`${t(p("create"))}${app.name}`} placement="bottom">
                      <Link href={`/apps/${clusterId}/create/${app.id}`}>
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
                                src={join(publicConfig.PUBLIC_PATH, app.logoPath)}
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
                      </Link>
                    </Tooltip>
                  </Card>
                </Col>
              ))}
            </Row>
          </CardContainer>
        )}
      </>
    </Spin>
  );
};
