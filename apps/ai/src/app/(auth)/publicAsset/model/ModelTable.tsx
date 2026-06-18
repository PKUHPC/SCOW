"use client";

import { PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Input, Form, Modal, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useCallback, useState } from "react";
import { CreateAndEditModalModal } from "src/components/assets/model/CreateAndEditModelModal";
import { CreateAndEditVersionModal } from "src/components/assets/model/CreateAndEditVersionModal";
import { TableExpandIcon } from "src/components/assets/TableExpandIcon";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CreateNewVersionIcon, DeleteIcon, EditIcon } from "src/icons/operationIcon";
import { ModelInterface } from "src/models/Model";
import { Cluster } from "src/server/trpc/route/config";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

import { PublicAssetTableContainer } from "../common";
import { ModelVersionList } from "./ModelVersionList";

interface Props {
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

export const ModalTable: React.FC<Props> = ({ clusters }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.modelTable.");
  const pCommon = prefix("app.common.");
  const languageId = useI18n().currentLanguage.id;

  const [{ confirm }, confirmModalHolder] = Modal.useModal();
  const { message } = App.useApp();

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
    isPublic: "true", // 保留获取已发布的模型数量
    isPlatformOwned: true,
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

  const deleteModel = useCallback(async (id: number) => {
    confirm({
      title: t(p("delete")),
      onOk: async () => {
        await deleteModelMutation.mutateAsync({ id, isPlatformOwned: true });
      },
    });
  }, []);

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
    { dataIndex: "description", title: t(p("description")) },
    { dataIndex: "algorithmName", title: t(p("algorithmName")) },
    { dataIndex: "algorithmFramework", title: t(p("algorithmFramework")) },
    { dataIndex: "versionsCount", title: t(p("versions")), render: (_, r) => r.versionsCount },
    { dataIndex: "versions", title: t(pCommon("publicVersions")), render: (_, r) => r.versions.length },
    {
      dataIndex: "updateTime",
      title: t(p("updatedTime")),
      render: (_, r) => (r.updateTime ? formatDateTime(r.updateTime) : "-"),
    },
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
              isPlatformOwned={true}
              usePublicPath={true}
            >
              <Tooltip title={t(p("createNewVersion"))}>
                <CreateNewVersionIcon />
              </Tooltip>
            </CreateVersionModalButton>
            <EditModalModalButton
              refetch={refetch}
              isPlatformOwned={true}
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
                  deleteModel(r.id);
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <PublicAssetTableContainer>
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
          initialValues={{ ...query, clusterId: ALL_FILTER_VALUE }}
          onFinish={async () => {
            const { nameOrDesc } = await form.validateFields();
            setQuery({ ...query, nameOrDesc: nameOrDesc?.trim() });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
            refetch();
          }}
        >
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
        <Space>
          <CreateModalModalButton refetch={refetch} isPlatformOwned={true}>
            {t("button.addButton")}
          </CreateModalModalButton>
        </Space>
      </FilterFormContainer>
      <Table
        className="public-asset-list-table"
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

      {/* antd中modal组件 */}
      {confirmModalHolder}
    </PublicAssetTableContainer>
  );
};
