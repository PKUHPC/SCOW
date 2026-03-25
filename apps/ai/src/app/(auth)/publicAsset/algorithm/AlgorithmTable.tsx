"use client";

import { PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Input, Modal, Select, Space, Table, TableColumnsType, Tooltip } from "antd";
import { useCallback, useState } from "react";
import { CreateAndEditAlgorithmModal } from "src/components/assets/algorithm/CreateAndEditAlgorithmModal";
import { CreateAndEditVersionModal } from "src/components/assets/algorithm/CreateAndEditVersionModal";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CreateNewVersionIcon, DeleteIcon, EditIcon } from "src/icons/operationIcon";
import { AlgorithmInterface, AlgorithmTypeText, Framework, getAlgorithmTexts } from "src/models/Algorithm";
import { Cluster } from "src/server/trpc/route/config";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

import { AlgorithmVersionList } from "./AlgorithmVersionList";

interface Props {
  clusters: Cluster[];
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FilterTypeForKeys = {
  ALL: "全部",
  ...AlgorithmTypeText,
} as const;


type FilterTypeKeys = keyof typeof FilterTypeForKeys;

interface FilterForm {
  framework?: FilterTypeKeys,
  nameOrDesc?: string,
  clusterId?: string,
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const CreateAlgorithmModalButton =
  ModalButton(CreateAndEditAlgorithmModal, { type: "primary", icon: <PlusOutlined /> });
const EditAlgorithmModalButton =
  ModalLink(CreateAndEditAlgorithmModal);
const CreateVersionModalButton = ModalLink(CreateAndEditVersionModal);

export const AlgorithmTable: React.FC<Props> = ({ clusters }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.algorithm.algorithmTable.");
  const pCommon = prefix("app.common.");
  const languageId = useI18n().currentLanguage.id;

  const FilterType = {
    ALL: getAlgorithmTexts(t).all,
    ...AlgorithmTypeText,
    [Framework.OTHER]:getAlgorithmTexts(t).other,
  } as const;

  const AlgorithmTypeTextTrans = {
    ...AlgorithmTypeText,
    [Framework.OTHER]:getAlgorithmTexts(t).other,
  };

  const [{ confirm }, confirmModalHolder] = Modal.useModal();
  const { message } = App.useApp();


  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      nameOrDesc: undefined,
      framework: undefined,
      clusterId:undefined,
    };
  });

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });

  const { data, isFetching, refetch, error } = trpc.algorithm.getAlgorithms.useQuery(
    { ...pageInfo,
      framework:query.framework === "ALL" ? undefined : query.framework,
      nameOrDesc:query.nameOrDesc,
      clusterId:query.clusterId,
      isPublic: "true", // 保留获取已发布的算法数量
      isPlatformOwned: true,
    });
  if (error) {
    message.error(t(p("notFound")));
  }

  const deleteAlgorithmMutation = trpc.algorithm.deleteAlgorithm.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
    },
    onError() {
      message.error(t(p("deleteFailed")));
    } });

  const deleteAlgorithm = useCallback(
    (id: number) => {
      confirm({
        title: t(p("delete")),
        onOk:async () => {
          await deleteAlgorithmMutation.mutateAsync({ id, isPlatformOwned: true });
        },
      });
    },
    [],
  );

  const getCurrentCluster = useCallback((clusterId: string) => {
    return clusters.find((c) => c.id === clusterId);
  }, [clusters]);

  const columns: TableColumnsType<AlgorithmInterface> = [
    { dataIndex: "name", title: t(p("name")),
      onCell: () => ({
        style: {
          maxWidth: 200,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }),
    },
    { dataIndex: "clusterId", title: t(p("cluster")),
      render: (_, r) =>
        getI18nConfigCurrentText(getCurrentCluster(r.clusterId)?.name, languageId) ?? r.clusterId },
    { dataIndex: "framework", title: t(p("framework")), render:(framework: Framework) =>
      AlgorithmTypeTextTrans[framework] },
    { dataIndex: "description", title: t(p("description")) },
    { dataIndex: "versionsCount", title: t(p("versions")),
      render: (_, r) => r.versionsCount },
    { dataIndex: "versions", title: t(pCommon("publicVersions")),
      render: (_, r) => r.versions.length },
    { dataIndex: "updateTime", title: t(p("updatedTime")),
      render: (_, r) => r.updateTime ? formatDateTime(r.updateTime) : "-" },
    { dataIndex: "action", title:  t(p("action")),
      render: (_: any, r: AlgorithmInterface) => {
        return (
          <Space direction="horizontal">
            <CreateVersionModalButton
              refetch={ () => { refetch(); }}
              algorithmId={r.id}
              algorithmName={r.name}
              cluster={getCurrentCluster(r.clusterId)}
              isPlatformOwned={true}
              usePublicPath={true}
            >
              <Tooltip title={t(p("createNewVersion"))}>
                <CreateNewVersionIcon />
              </Tooltip>
            </CreateVersionModalButton>
            <EditAlgorithmModalButton
              refetch={refetch}
              isPlatformOwned={true}
              editData={{
                cluster:getCurrentCluster(r.clusterId),
                algorithmName:r.name,
                algorithmId:r.id,
                algorithmFramework:r.framework,
                algorithmDescription:r.description,
              }}
            >
              <Tooltip title={t("button.editButton")}>
                <EditIcon />
              </Tooltip>
            </EditAlgorithmModalButton>
            <Tooltip title={t("button.deleteButton")}>
              <DeleteIcon onClick={() => {
                deleteAlgorithm(r.id);
              }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <FilterFormContainer style={{
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
          <Form.Item label={t(p("cluster"))} name="clusterId">
            <SingleClusterSelector
              allowClear={true}
              onChange={(val) => {
                setQuery({ ...query, clusterId:val.id });
              }}
            />
          </Form.Item>
          <Form.Item label={t(p("framework"))} name="framework">
            <Select
              style={{ minWidth: "120px" }}
              allowClear
              onChange={(val: FilterTypeKeys) => {
                setQuery({ ...query, framework:val });
              }}
              placeholder={t(p("selectFramework"))}
              defaultValue={"ALL"}
              options={
                Object.entries(FilterType).map(([key, value]) => ({ label:value, value:key }))
              }
            >
            </Select>
          </Form.Item>
          <Form.Item name="nameOrDesc">
            <Input allowClear placeholder={t(p("nameOrDesc"))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit"> {t("button.searchButton")} </Button>
          </Form.Item>
        </Form>
        <Space>
          <CreateAlgorithmModalButton refetch={refetch} isPlatformOwned={true}>
            {t("button.addButton")}
          </CreateAlgorithmModalButton>
        </Space>
      </FilterFormContainer>
      <Table
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
            return cluster && (
              <AlgorithmVersionList
                algorithms={data?.items ?? []}
                algorithmName={record.name}
                algorithmId={record.id}
                cluster={cluster}
              ></AlgorithmVersionList>
            );
          },
        }}
        scroll={{ x: true }}
      />
      {/* antd中modal组件 */}
      {confirmModalHolder}
    </div>
  );
};
