import { PictureOutlined } from "@ant-design/icons";
import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { Avatar, Card, Col, Form, Row, Space, Spin, Tooltip } from "antd";
import { join } from "path";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

interface App { id: string; name: string; logoPath?: string; };

const CardContainer = styled.div`
  flex: 1;
  display: flex;
  flex-wrap: wrap;
`;

const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
  cursor: pointer;
  text-decoration: underline;
`;

const NameContainer = styled.div`
  text-align: center;
  margin-top: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  color: ${(props) => props.theme.token.colorPrimary};
`;

const SearchContainer = styled(Space)`
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    background: ${({ theme }) => theme.token.colorBgContainer};
    border-radius: 12px;
    padding: 12px 10px 12px 20px;
`;

const AppListContainer = styled.div`
    background: ${({ theme }) => theme.token.colorBgContainer};
    padding: 20px 30px 10px;
    border-radius: 8px;
    min-height: calc(100vh - 236px);
`;

interface FilterForm {
  appName: string | undefined;
}

interface Props {
  allApps: App[];
  isLoading: boolean;
  selectedCluster: string | undefined;
  setSelectedCluster: (value: string | undefined) => void;
  setSelectedAppInfo: (value: App) => void;
}

type ImageErrorMap = Record<string, boolean>;

const p = prefix("pageComp.app.createApps.");

export const CreateAppsTable: React.FC<Props> = ({ allApps, isLoading,
  selectedCluster, setSelectedCluster, setSelectedAppInfo }) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    appName: undefined,
  };
  const { currentClusters } = useStore(ClusterInfoStore);

  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);

  const [imageErrorMap, setImageErrorMap] = useState<ImageErrorMap>({});

  const handleImageError = (appId: string) => {
    setImageErrorMap((prevMap) => ({ ...prevMap, [appId]: true }));
  };

  // 前端过滤查询结果
  const filteredData = useMemo(() => {

    if (!allApps) return [];
    if (!query.appName) {
      return allApps;
    }
    const filteredValues = allApps
      .filter((app) => app.name.toLowerCase().includes(query.appName?.toLowerCase() || ""));
    return filteredValues;

  }, [allApps, query]);

  useEffect(() => {
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  }, [selectedCluster, filterForm]);

  return (
    <Spin spinning={isLoading} tip={isLoading ? t(p("loading")) : ""} style={{ marginTop: "150px" }}>
      <SearchContainer>
        <Space wrap>
          <span style={{ marginRight: "8px" }}>{t(p("cluster"))}</span>
          <RoundedButton
            size="middle"
            type={selectedCluster === undefined ? "primary" : "default"}
            $selected={!selectedCluster}
            onClick={() => {
              setSelectedCluster(undefined);
            }}
          >
            {t(p("all"))}
          </RoundedButton>
          {currentClusters.map((cluster) => {
            const button = (
              <RoundedButton
                size="middle"
                key={cluster.id}
                type={selectedCluster === cluster.id ? "primary" : "default"}
                $selected={selectedCluster === cluster.id}
                onClick={() => {
                  setSelectedCluster(cluster.id);
                }}
              >
                {getI18nConfigCurrentText(cluster.name, languageId)}
              </RoundedButton>
            );

            return (
              <Tooltip
                key={cluster.id}
                arrow={false}
                align={{ offset: [0, -12]}}
              >
                <span>{button}</span>
              </Tooltip>
            );
          })}
        </Space>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={initialFilterQuery}
        >
          <Form.Item name="appName">
            <RoundedSearch
              placeholder={t(p("searchPlaceholder"))}
              onSearch={
                async () => {
                  const { appName } = await filterForm.validateFields();
                  setQuery({ appName: appName === "" ? undefined : appName?.trim() });
                }
              }
              size="large"
              enterButton
            />
          </Form.Item>
        </Form>
      </SearchContainer>
      <AppListContainer>
        {!isLoading && filteredData?.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "100px", fontSize: "16px" }}>
            {query.appName ? t(p("noSearchResult"), [query.appName]) : t(p("notFoundMessage"))}
          </div>
        ) : (
          <CardContainer>
            <Row gutter={16} style={{ flex: 1, width: "100%" }}>
              {filteredData?.map((app) => (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} xxl={4} key={app.id} style={{ marginBottom: "16px" }}>
                  <Card
                    styles={{
                      body: { display: "flex", flexDirection: "column", height: "100%" },
                    }}
                  >
                    <Tooltip title={`${t(p("create"))}${app.name}`} placement="bottom">
                      <div onClick={() => { setSelectedAppInfo(app); }}>
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
                      </div>
                    </Tooltip>
                  </Card>
                </Col>
              ))}
            </Row>
          </CardContainer>
        )}
      </AppListContainer>
    </Spin>
  );
};
