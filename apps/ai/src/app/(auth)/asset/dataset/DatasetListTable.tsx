"use client";

import { PlusOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TRPCClientError } from "@trpc/client";
import { App, Button, Form, Modal, Select, Space, Table, Tooltip } from "antd";
import { useCallback, useState } from "react";
import { CreateEditDatasetModal } from "src/components/assets/dataset/CreateEditDatasetModal";
import { CreateEditDSVersionModal } from "src/components/assets/dataset/CreateEditDSVersionModal";
import { TableExpandIcon } from "src/components/assets/TableExpandIcon";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CreateNewVersionIcon, DeleteIcon, EditIcon, PlatformIcon } from "src/icons/operationIcon";
import { DatasetTypeText, getDatasetTexts } from "src/models/Dateset";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { AppRouter } from "src/server/trpc/router";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { useTheme } from "styled-components";

import { TableContainer } from "../common";
import { PlatformTag } from "../PlatformTag";
import { DatasetVersionList } from "./DatasetVersionList";

interface Props {
  isPublic: boolean;
  clusters: Cluster[];
  currentClusterIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FilterTypeForKeys = {
  ALL: "全部",
  ...DatasetTypeText,
} as Record<string, string>;

type FilterTypeKeys = Extract<keyof typeof FilterTypeForKeys, string>;

interface FilterForm {
  cluster?: Cluster | undefined;
  type?: FilterTypeKeys | undefined;
  nameOrDesc?: string | undefined;
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const CreateDatasetModalButton = ModalButton(CreateEditDatasetModal, { type: "primary", icon: <PlusOutlined /> });
const EditDatasetModalButton = ModalLink(CreateEditDatasetModal);
const CreateEditVersionModalButton = ModalLink(CreateEditDSVersionModal);

export const DatasetListTable: React.FC<Props> = ({ isPublic, clusters, currentClusterIds }) => {
  const t = useI18nTranslateToString();
  const pModel = prefix("app.dataset.model.");
  const p = prefix("app.dataset.datasetListTable.");
  const pCommon = prefix("app.common.");
  const languageId = useI18n().currentLanguage.id;
  const theme = useTheme();

  // 本来应该是放在组件外，但是为了国际化将其放入组件中
  const FilterType = {
    ALL: t(pModel("all")),
    IMAGE: t(pModel("image")),
    TEXT: t(pModel("text")),
    VIDEO: t(pModel("video")),
    AUDIO: t(pModel("audio")),
    OTHER: t(pModel("other")),
  } as Record<string, string>;

  const SceneTypeText: Record<string, string> = {
    CWS: t(pModel("ces")),
    DA: t(pModel("da")),
    IC: t(pModel("ic")),
    OD: t(pModel("od")),
    OTHER: t(pModel("other")),
  };
  const DatasetTypeTextTrans: Record<string, string> = {
    IMAGE: getDatasetTexts(t).image,
    TEXT: getDatasetTexts(t).text,
    VIDEO: getDatasetTexts(t).video,
    AUDIO: getDatasetTexts(t).audio,
    OTHER: getDatasetTexts(t).other,
  };
  const [{ confirm }, confirmModalHolder] = Modal.useModal();

  const { message } = App.useApp();

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      cluster: undefined,
      nameOrDesc: undefined,
      type: undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });

  const { data, refetch, isFetching, error } = trpc.dataset.list.useQuery({
    ...pageInfo,
    ...query,
    clusterId: query.cluster?.id,
    isPublic: parseBooleanParam(isPublic),
  });
  if (error) {
    message.error(t(p("notFound")));
  }

  const deleteDatasetMutation = trpc.dataset.deleteDataset.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("deleteSuccessfully")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else {
        message.error(t(p("deleteFailed")));
      }
    },
  });

  const deleteDataset = useCallback((id: number) => {
    confirm({
      title: t(p("delete")),
      onOk: async () => {
        await deleteDatasetMutation.mutateAsync({ id });
      },
    });
  }, []);

  const getCurrentCluster = useCallback(
    (clusterId: string | undefined) => {
      if (clusterId) {
        return clusters.find((c) => c.id === clusterId);
      }
    },
    [clusters],
  );

  return (
    <TableContainer>
      <FilterFormContainer
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingLeft: 0,
          paddingTop: 0,
          marginLeft: "-2px",
        }}
      >
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { nameOrDesc } = await form.validateFields();
            setQuery({ ...query, nameOrDesc: nameOrDesc?.trim() });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
            refetch();
          }}
        >
          <Form.Item label={t(p("cluster"))} name="cluster">
            <SingleClusterSelector
              allowClear={true}
              onChange={(value) => {
                setQuery({ ...query, cluster: value });
              }}
            />
          </Form.Item>
          <Form.Item label={t(p("type"))} name="type">
            <Select
              style={{ minWidth: "100px" }}
              allowClear
              onChange={(value: FilterTypeKeys) => {
                setQuery({ ...query, type: value === "ALL" ? undefined : value });
              }}
              placeholder={t(p("selectType"))}
              options={Object.entries(FilterType).map(([key, value]) => ({ label: value, value: key }))}
            />
          </Form.Item>
          <Form.Item name="nameOrDesc">
            <Input allowClear placeholder={t(p("nameOrDesc"))} />
          </Form.Item>
          <Button className="ant-form-item" type="primary" htmlType="submit">
            {t("button.searchButton")}
          </Button>
        </Form>
        {!isPublic && (
          <Space>
            <CreateDatasetModalButton
              refetch={refetch}
              isEdit={false}
              clusters={clusters}
              currentClusterIds={currentClusterIds}
            >
              {t("button.addButton")}
            </CreateDatasetModalButton>
          </Space>
        )}
      </FilterFormContainer>
      <Table
        className="dataset-list-table dataset-asset-list-table"
        rowKey="id"
        dataSource={data?.items}
        loading={isFetching}
        tableLayout="fixed"
        columns={[
          {
            dataIndex: "name",
            title: t(p("name")),
            onCell: () => ({
              style: {
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }),
          },
          {
            dataIndex: "clusterId",
            title: t(p("cluster")),
            render: (_, r) => getI18nConfigCurrentText(getCurrentCluster(r.clusterId)?.name, languageId) ?? r.clusterId,
          },
          { dataIndex: "type", title: t(p("datasetType")), render: (_, r) => DatasetTypeTextTrans[r.type] },
          {
            dataIndex: "description",
            title: t(p("description")),
            onCell: () => ({
              style: {
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }),
          },
          { dataIndex: "scene", title: t(p("scene")), render: (_, r) => SceneTypeText[r.scene] },
          { dataIndex: "versions", title: t(p("versions")), render: (_, r) => r.versions.length },
          ...(isPublic
            ? [
                {
                  dataIndex: "shareUser",
                  title: t(pCommon("publishUser")),
                  // @ts-ignore
                  render: (_, r) =>
                    r.isPlatformOwned ? (
                      <PlatformTag color={theme.token.colorPrimary}>
                        <span>{t(pCommon("platform"))}</span>
                        <PlatformIcon />
                      </PlatformTag>
                    ) : (
                      `${r.ownerName}（ID:${r.owner}）`
                    ),
                } as const,
              ]
            : []),
          {
            dataIndex: "updateTime",
            title: t(p("updatedTime")),
            render: (_, r) => (r.updateTime ? formatDateTime(r.updateTime) : "-"),
          },
          ...(!isPublic
            ? [
                {
                  dataIndex: "action",
                  title: t(p("action")),
                  render: (_: any, r: DatasetInterface) => {
                    return (
                      <Space direction="horizontal">
                        <CreateEditVersionModalButton
                          datasetId={r.id}
                          datasetName={r.name}
                          cluster={getCurrentCluster(r.clusterId)}
                          refetch={() => {
                            refetch();
                          }}
                        >
                          <Tooltip title={t(p("createNewVersion"))}>
                            <CreateNewVersionIcon />
                          </Tooltip>
                        </CreateEditVersionModalButton>
                        <EditDatasetModalButton
                          refetch={refetch}
                          isEdit={true}
                          editData={r}
                          clusters={clusters}
                          currentClusterIds={currentClusterIds}
                        >
                          <Tooltip title={t("button.editButton")}>
                            <EditIcon />
                          </Tooltip>
                        </EditDatasetModalButton>
                        <Tooltip title={t("button.deleteButton")}>
                          <DeleteIcon
                            onClick={() => {
                              deleteDataset(r.id);
                            }}
                          />
                        </Tooltip>
                      </Space>
                    );
                  },
                },
              ]
            : []),
        ]}
        pagination={
          setPageInfo
            ? {
                current: pageInfo.page,
                defaultPageSize: 10,
                pageSize: pageInfo.pageSize,
                showSizeChanger: true,
                total: data?.count,
                onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
              }
            : false
        }
        expandable={{
          expandedRowRender: (record) => {
            const cluster = getCurrentCluster(record.clusterId);
            return (
              cluster && (
                <DatasetVersionList
                  isPublic={isPublic}
                  datasets={data?.items ?? []}
                  datasetId={record.id}
                  datasetName={record.name}
                  cluster={cluster}
                ></DatasetVersionList>
              )
            );
          },
          expandIcon: (props) => <TableExpandIcon {...props} />,
        }}
        scroll={{ x: true }}
      />
      {/* antd中modal组件 */}
      {confirmModalHolder}
    </TableContainer>
  );
};
