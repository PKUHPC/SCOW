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

import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { JobTemplateInfo } from "@scow/protos/build/portal/job";
import { App, Button, Divider,Form, Input, Modal, Popconfirm, Space, Table, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import Link from "next/link";
import React, { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DeleteIcon, RenameIcon,UsingTemplateIcon } from "src/icons/operationIcon";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";

interface Props {}

interface FilterForm {
  cluster: Cluster;
}

interface FormProps {
  jobName: string;
}

interface ModalProps {
  open: boolean;
  cluster: string;
  templateId: string;
  close: () => void;
  reload: () => void;
}

const p = prefix("pageComp.job.jobTemplateModal.");
const pCommon = prefix("common.");

export const JobTemplateTable: React.FC<Props> = () => {

  const { currentClusters, defaultCluster } = useStore(ClusterInfoStore);

  if (!defaultCluster && currentClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      cluster: defaultCluster ?? currentClusters[0],
    };
  });

  const [form] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {
    return await api.listJobTemplates({ query: {
      cluster: query.cluster.id,
    } }).then((x) => x.results);
  }, [query.cluster]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const t = useI18nTranslateToString();

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            setQuery({
              ...(await form.validateFields()),
            });
          }}
        >
          <Form.Item label={t(p("clusterLabel"))} name="cluster">
            <SingleClusterSelector />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">{t("button.searchButton")}</Button>
              <Button loading={isLoading} onClick={reload}>{t("button.refreshButton")}</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <InfoTable
        data={data}
        isLoading={isLoading}
        cluster={query.cluster}
        reload={reload}
      />
    </div>
  );
};

const NewTemplateNameModal: React.FC<ModalProps> = ({
  open, close, reload, cluster, templateId,
}) => {

  const t = useI18nTranslateToString();

  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormProps>();

  const onOk = async () => {
    const { jobName } = await form.validateFields();
    setLoading(true);

    await api.renameJobTemplate({ body: {
      cluster,
      templateId,
      jobName,
    } })
      .httpError(404, () => {
        message.error(t(p("errorMessage")));
      })
      .httpError(429, () => { message.error(t(pCommon("noSpaceError"))); })
      .then(() => {
        message.success(t(p("changeSuccessMessage")));
        reload();
        close();
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Modal
      title={t(p("changTemplateName"))}
      open={open}
      onCancel={close}
      onOk={onOk}
      confirmLoading={loading}
    >
      <Form form={form}>
        <Form.Item name="jobName" rules={[{ required: true }]} label={t(p("newTemplateName"))}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};


interface InfoTableProps {
  data?: JobTemplateInfo[];
  isLoading: boolean;
  cluster: Cluster;
  reload: () => void;
}

const InfoTable: React.FC<InfoTableProps> = ({
  data, isLoading, cluster, reload,
}) => {
  const { message } = App.useApp();
  const [modalShow, setModalShow] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const t = useI18nTranslateToString();

  const columns: ColumnsType<JobTemplateInfo> = [
    {
      dataIndex: "jobName",
      title: t(p("templateName")),
    },
    {
      dataIndex: "comment",
      title: t(p("comment")),
      width:"40%",
    },
    {
      dataIndex: "action",
      title: t("button.actionButton"),
      render:(_, r) => (
        <Space size={8} style={{ marginLeft: 4 }}>
          <Tooltip title={t(p("useTemplate"))}>
            <Link
              href={{
                pathname: "/jobs/submit",
                query: {
                  cluster: cluster.id,
                  jobTemplateId: r.id,
                },
              }}
              onClick={r.jobName === "unknown" ? (e) => e.preventDefault() : undefined}
              style={r.jobName === "unknown" ? { color: "grey", cursor: "not-allowed" } : {}}
            >
              <UsingTemplateIcon />
            </Link>
          </Tooltip>
          <Tooltip title={t("button.renameButton")}>
            <RenameIcon
              style={r.jobName === "unknown" ? { color: "grey", cursor: "not-allowed" } : {}}
              onClick={() => {
                if (r.jobName === "unknown") return;

                setTemplateId(r.id); setModalShow(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t(p("popConfirm"))}
            onConfirm={async () =>
              api.deleteJobTemplate({
                query: {
                  cluster: cluster.id,
                  templateId: r.id,
                },
              })
                .httpError(404, () => {
                  message.error(t(p("errorMessage")));
                })
                .then(() => {
                  message.success(t(p("deleteSuccessMessage")));
                  reload();
                })
            }
          >
            <Tooltip title={t("button.deleteButton")}>
              <DeleteIcon />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <NewTemplateNameModal
        cluster={cluster.id}
        templateId={templateId}
        close={() => setModalShow(false)}
        open={modalShow}
        reload={reload}
      />
      <Table
        tableLayout="fixed"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
        rowKey={(x) => x.id}
      />
    </>
  );
};


