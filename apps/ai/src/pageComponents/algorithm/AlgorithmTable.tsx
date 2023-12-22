/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

"use client";

import { PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Divider, Form, Input, Modal, Select, Space, Table, TableColumnsType } from "antd";
import { useCallback, useMemo, useState } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { AlgorithmTypeText, Framework } from "src/models/Algorithm";
import { Cluster } from "src/utils/config";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

import { CreateAndEditAlgorithmModal } from "./CreateAndEditAlgorithmModal";
import { CreateAndEditVersionModal } from "./CreateAndEditVersionModal";
import { VersionListModal } from "./VersionListModal";

interface Props {
  isPublic: boolean;
  clusters: Cluster[];
}

const FilterType = {
  ALL: "全部",
  ...AlgorithmTypeText,
} as const;

type FilterTypeKeys = keyof typeof FilterType;

interface FilterForm {
  framework?: FilterTypeKeys,
  nameOrDesc?: string,
  clusterId?: string,
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface Algorithm {
  id: number;
  name: string;
  owner: string;
  framework: Framework;
  isShared: boolean;
  description: string;
  clusterId: string;
  createTime: string;
  versions: number;
}

const CreateAlgorithmModalButton =
ModalButton(CreateAndEditAlgorithmModal, { type: "primary", icon: <PlusOutlined /> });
const EditAlgorithmModalButton =
ModalButton(CreateAndEditAlgorithmModal, { type: "link" });
const CreateAndEditVersionModalButton = ModalButton(CreateAndEditVersionModal, { type: "link" });
const VersionListModalButton = ModalButton(VersionListModal, { type: "link" });

export const AlgorithmTable: React.FC<Props> = ({ isPublic, clusters }) => {

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
    });

  if (error) {
    message.error("找不到算法");
  }

  const deleteAlgorithmMutation = trpc.algorithm.deleteAlgorithm.useMutation({
    onSuccess() {
      message.success("删除算法成功");
      refetch();
    },
    onError(e) {
      console.log(e);
      message.error("删除算法失败");
    } });

  const deleteAlgorithm = useCallback(
    (id: number, name: string) => {
      confirm({
        title: "删除算法",
        content: `确认删除算法${name}？如该算法已分享，则分享的算法也会被删除。`,
        onOk() {
          deleteAlgorithmMutation.mutate({ id });
        },
      });
    },
    [],
  );

  const columns: TableColumnsType<Algorithm> = [
    { dataIndex: "name", title: "名称" },
    { dataIndex: "clusterId", title: "集群",
      render: (_, r) =>
        getI18nConfigCurrentText(clusters.find((x) => (x.id === r.clusterId))?.name, undefined) ?? r.clusterId },
    { dataIndex: "framework", title: "算法框架", render:(_: Framework) => AlgorithmTypeText[_] },
    { dataIndex: "description", title: "算法描述" },
    { dataIndex: "versions", title: "版本数量",
      render: (_, r) => {
        return r.versions;
      } },
    isPublic ? { dataIndex: "shareUser", title: "分享者",
      render: (_, r) => {
        return r.owner;
      } } : {},
    { dataIndex: "createTime", title: "创建时间",
      render:(_) => formatDateTime(_),
    },
    { dataIndex: "action", title: "操作",
      render: (_, r) => {
        return !isPublic ?
          (
            <>
              <CreateAndEditVersionModalButton
                algorithmId={r.id}
                algorithmName={r.name}
              >
                创建新版本
              </CreateAndEditVersionModalButton>
              <VersionListModalButton
                algorithmId={r.id}
                algorithmName={r.name}
              >
                版本列表
              </VersionListModalButton>
              <EditAlgorithmModalButton
                refetch={refetch}
                clusterId={r.clusterId}
                algorithmName={r.name}
                algorithmFramework={r.framework}
                algorithmDescription={r.description}
              >
                编辑
              </EditAlgorithmModalButton>
              <Button
                type="link"
                onClick={() => {
                  deleteAlgorithm(r.id, r.name);
                }}
              >
                删除
              </Button>
            </>
          ) :
          (
            <VersionListModalButton
              algorithmId={r.id}
              algorithmName={r.name}
              isPublic
            >
              版本列表
            </VersionListModalButton>
          );
      },
    },
  ];




  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { nameOrDesc } = await form.validateFields();
            setQuery({ ...query, nameOrDesc: nameOrDesc?.trim() });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <Form.Item label="集群" name="clusterId">
            <SingleClusterSelector
              allowClear={true}
              onChange={(val) => {
                setQuery({ ...query, clusterId:val.id });
              }}
            />
          </Form.Item>
          <Form.Item label="算法框架" name="framework">
            <Select
              style={{ minWidth: "120px" }}
              allowClear
              onChange={(val: FilterTypeKeys) => {
                setQuery({ ...query, framework:val });
              }}
              placeholder="请选择算法框架"
              defaultValue={"ALL"}
              options={
                Object.entries(FilterType).map(([key, value]) => ({ label:value, value:key }))}
            >
            </Select>
          </Form.Item>
          <Form.Item name="nameOrDesc">
            <Input allowClear placeholder="名称或描述" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">搜索</Button>
          </Form.Item>
        </Form>
        {!isPublic && (
          <Space>
            <CreateAlgorithmModalButton refetch={refetch}> 添加 </CreateAlgorithmModalButton>
          </Space>
        )}
      </FilterFormContainer>
      <Table
        rowKey="id"
        dataSource={data?.items}
        loading={isFetching}
        columns={columns.filter((x) => Object.keys(x).length)}
        pagination={{
          current: pageInfo.page,
          defaultPageSize: 10,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.count,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
        scroll={{ x: true }}
      />
      {/* antd中modal组件 */}
      {confirmModalHolder}
    </div>
  );
};

