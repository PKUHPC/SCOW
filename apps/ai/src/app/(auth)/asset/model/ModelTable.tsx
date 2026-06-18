"use client";

import { PlusOutlined } from "@ant-design/icons";
import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Input, Form, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useCallback, useState } from "react";
import { CreateAndEditModalModal } from "src/components/assets/model/CreateAndEditModelModal";
import { CreateAndEditVersionModal } from "src/components/assets/model/CreateAndEditVersionModal";
import { TableExpandIcon } from "src/components/assets/TableExpandIcon";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CreateNewVersionIcon, DeleteIcon, EditIcon, PlatformIcon } from "src/icons/operationIcon";
import { ModelInterface } from "src/models/Model";
import { Cluster } from "src/server/trpc/route/config";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { useTheme } from "styled-components";

import { TableContainer } from "../common";
import { PlatformTag } from "../PlatformTag";
import { ModelVersionList } from "./ModelVersionList";

interface Props {
  isPublic: boolean;
  clusters: Cluster[];
}

interface FilterForm {
  nameOrDesc?: string;
  clusterId?: string;
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const CreateModalModalButton = ModalButton(CreateAndEditModalModal, { type: "primary", icon: <PlusOutlined /> });
const EditModalModalButton = ModalLink(CreateAndEditModalModal);
const CreateVersionModalButton = ModalLink(CreateAndEditVersionModal);
const ALL_FILTER_VALUE = "ALL";

export const ModalTable: React.FC<Props> = ({ isPublic, clusters }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.modelTable.");
  const pCommon = prefix("app.common.");
  const languageId = useI18n().currentLanguage.id;
  const theme = useTheme();

  const { message } = App.useApp();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      nameOrDesc: undefined,
      framework: undefined,
      clusterId: undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });

  const { data, isFetching, refetch, error } = trpc.model.list.useQuery({
    ...pageInfo,
    nameOrDesc: query.nameOrDesc,
    clusterId: query.clusterId,
    isPublic: parseBooleanParam(isPublic),
  });
  if (error) {
    message.error(t(p("notFound")));
  }

  const deleteModelMutation = trpc.model.deleteModel.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
    },
    onError() {
      message.error(t(p("deleteFailed")));
    },
  });

  const openDeleteModal = useCallback((id: number) => {
    setDeleteId(id);
  }, []);

  const handleDeleteOk = useCallback(async () => {
    if (deleteId == null) {
      return;
    }
    await deleteModelMutation.mutateAsync({ id: deleteId });
    setDeleteId(null);
  }, [deleteId, deleteModelMutation]);

  const getCurrentCluster = useCallback(
    (clusterId: string) => {
      return clusters.find((c) => c.id === clusterId);
    },
    [clusters],
  );

  const columns: TableColumnsType<ModelInterface> = [
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
    { dataIndex: "algorithmName", title: t(p("algorithmName")) },
    { dataIndex: "algorithmFramework", title: t(p("algorithmFramework")) },
    { dataIndex: "versions", title: t(p("versions")), render: (versions) => versions.length },
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
            render: (_: any, r: ModelInterface) => {
              return (
                <Space>
                  <CreateVersionModalButton
                    refetch={() => {
                      refetch();
                    }}
                    modelId={r.id}
                    modelName={r.name}
                    cluster={getCurrentCluster(r.clusterId)}
                  >
                    <Tooltip title={t(p("createNewVersion"))}>
                      <CreateNewVersionIcon />
                    </Tooltip>
                  </CreateVersionModalButton>
                  <EditModalModalButton
                    refetch={refetch}
                    editData={{
                      cluster: getCurrentCluster(r.clusterId),
                      modelId: r.id,
                      modelName: r.name,
                      algorithmName: r.algorithmName,
                      algorithmFramework: r.algorithmFramework,
                      modalDescription: r.description,
                    }}
                  >
                    <Tooltip title={t("button.editButton")}>
                      <EditIcon />
                    </Tooltip>
                  </EditModalModalButton>
                  <Tooltip title={t("button.deleteButton")}>
                    <DeleteIcon
                      onClick={() => {
                        openDeleteModal(r.id);
                      }}
                    />
                  </Tooltip>
                </Space>
              );
            },
          },
        ]
      : []),
  ];

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
        <Form<FilterForm> layout="inline" form={form} initialValues={{ ...query, clusterId: ALL_FILTER_VALUE }}>
          <Form.Item label={t(p("cluster"))} name="clusterId">
            <SingleClusterSelector
              includeAllOption
              style={{ minWidth: "120px" }}
              onChange={(clusterId) => {
                setQuery({ ...query, clusterId: clusterId === ALL_FILTER_VALUE ? undefined : clusterId });
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
              }}
            />
          </Form.Item>
          <Form.Item name="nameOrDesc">
            <Input.Search
              placeholder={t(p("nameOrDes"))}
              onSearch={async () => {
                const { nameOrDesc } = await form.validateFields();
                setQuery({ ...query, nameOrDesc: nameOrDesc?.trim() });
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                refetch();
              }}
              enterButton
            />
          </Form.Item>
        </Form>
        {!isPublic && (
          <Space>
            <CreateModalModalButton refetch={refetch}>{t("button.addButton")}</CreateModalModalButton>
          </Space>
        )}
      </FilterFormContainer>
      <Table
        className="dataset-list-table"
        rowKey="id"
        dataSource={data?.items}
        loading={isFetching}
        columns={columns.filter((x) => Object.keys(x).length)}
        tableLayout="fixed"
        pagination={{
          current: pageInfo.page,
          defaultPageSize: 10,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.count,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
        expandable={{
          expandedRowRender: (record) => {
            const cluster = getCurrentCluster(record.clusterId);
            return (
              cluster && (
                <ModelVersionList
                  isPublic={isPublic}
                  models={data?.items ?? []}
                  modelId={record.id}
                  modelName={record.name}
                  cluster={cluster}
                ></ModelVersionList>
              )
            );
          },
          expandIcon: (props) => <TableExpandIcon {...props} />,
        }}
        scroll={{ x: true }}
      />

      <AppRouterStyledModal
        title={t(p("delete"))}
        open={deleteId !== null}
        onOk={handleDeleteOk}
        onCancel={() => setDeleteId(null)}
        confirmLoading={deleteModelMutation.isPending}
        destroyOnClose
      />
    </TableContainer>
  );
};
