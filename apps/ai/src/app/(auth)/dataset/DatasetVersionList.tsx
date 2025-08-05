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

import { TRPCClientError } from "@trpc/client";
import { App, Button, Space,Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancleShareIcon, CopyIcon, DeleteIcon, EditIcon, ShareIcon,ViewFileIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { AppRouter } from "src/server/trpc/router";
import { getSharedStatusText, getSharedStatusUpperText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { CopyPublicDatasetModal } from "./CopyPublicDatasetModal";
import { CreateEditDSVersionModal } from "./CreateEditDSVersionModal";

export interface Props {
  datasets: DatasetInterface[];
  datasetId: number;
  datasetName: string;
  isPublic?: boolean;
  cluster: Cluster;
}

const CopyPublicDatasetModalButton = ModalButton(CopyPublicDatasetModal, { type: "link" });

export const DatasetVersionList: React.FC<Props> = (
  { datasets, datasetId, datasetName, isPublic, cluster },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.datasetVersionList.");
  const pCommon = prefix("app.common.");

  const { modal, message } = App.useApp();
  const CreateEditVersionModalButton = ModalButton(CreateEditDSVersionModal, { type: "link" });

  const router = useRouter();

  const { data: versionData, isFetching, refetch, error: versionError }
    = trpc.dataset.versionList.useQuery({
      datasetId,
      isPublic:  isPublic !== undefined ? parseBooleanParam(isPublic) : undefined,
    });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [datasets]);

  const checkFileExist = trpc.file.checkFileExist.useMutation();

  const shareMutation = trpc.dataset.shareDatasetVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("submitShare")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthShare")));
      } else {
        message.error(t(p("shareFailed")));
      }
    },
  });

  const unShareMutation = trpc.dataset.unShareDatasetVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelShare")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthCancel")));
      } else {
        message.error(t(p("cancelShareFailed")));
      }
    },
  });

  const deleteMutation = trpc.dataset.deleteDatasetVersion.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
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

  const deleteDatasetVersion = useCallback(
    (id: number, datasetId: number, isConfirmed?: boolean) => {
      modal.confirm({
        title: isConfirmed ? t(p("confirmedText")) : t(p("delete")),
        onOk: async () => {
          await deleteMutation.mutateAsync({
            datasetVersionId: id,
            datasetId,
          });
        },
      });
    },
    [],
  );

  return (
    <Table
      rowKey="id"
      dataSource={versionData?.items ?? []}
      loading={isFetching}
      pagination={false}
      scroll={{ y:275 }}
      columns={[
        { dataIndex: "versionName", title: t(p("versionName")) },
        { dataIndex: "versionDescription", title: t(p("versionDescription")) },
        ...(isPublic ? [] : [{ dataIndex: "privatePath", title: t(p("path")) }]),
        { dataIndex: "createTime", title: t(p("createTime")),
          render: (_, r) => r.createTime ? formatDateTime(r.createTime) : "-" },
        { dataIndex: "action", title: t(p("action")),
          render: (_, r) => {
            return !isPublic ? (
              <Space direction="horizontal">
                <CreateEditVersionModalButton
                  key="edit"
                  datasetId={r.datasetId}
                  datasetName={datasetName}
                  cluster={cluster}
                  isEdit={true}
                  editData={r}
                  refetch={refetch}
                >
                  <Tooltip title={t("button.editButton")}>
                    <EditIcon />
                  </Tooltip>
                </CreateEditVersionModalButton>
                <Button
                  type="link"
                  onClick={async () => {
                    const checkExistRes =
                    await checkFileExist.mutateAsync({ clusterId:cluster.id, path:r.privatePath });

                    if (checkExistRes?.exists) {
                      router.push(`/files/${cluster.id}${r.privatePath}`);
                    } else {
                      deleteDatasetVersion(r.id, r.datasetId, true);
                    }
                  }}
                >
                  <Tooltip title={t(p("check"))}>
                    <ViewFileIcon />
                  </Tooltip>
                </Button>
                <Button
                  type="link"
                  disabled={r.sharedStatus === SharedStatus.SHARING || r.sharedStatus === SharedStatus.UNSHARING}
                  onClick={() => {
                    modal.confirm({
                      title: t(p("share")),
                      content:
                      `${t(p("confirmed"),[t(pCommon(getSharedStatusText(r.sharedStatus))),r.versionName])}`,
                      onOk: async () => {
                        if (r.sharedStatus === SharedStatus.SHARED) {
                          await unShareMutation.mutateAsync({
                            datasetVersionId: r.id,
                            datasetId: r.datasetId,
                          });
                        } else {
                          await shareMutation.mutateAsync({
                            datasetVersionId: r.id,
                            datasetId: r.datasetId,
                          });
                        }
                      },
                    });
                  }}
                >
                  <Tooltip title={t(pCommon(getSharedStatusUpperText(r.sharedStatus)))}>
                    {(r.sharedStatus === SharedStatus.SHARED || r.sharedStatus === SharedStatus.UNSHARING) ? (
                      <CancleShareIcon
                        disabled={r.sharedStatus === SharedStatus.UNSHARING}
                      />
                    ) : (
                      <ShareIcon
                        disabled={r.sharedStatus === SharedStatus.SHARING}
                      />
                    )}
                  </Tooltip>
                </Button>
                <Button
                  type="link"
                  disabled={r.sharedStatus === SharedStatus.SHARING || r.sharedStatus === SharedStatus.UNSHARING}
                  onClick={() => {
                    deleteDatasetVersion(r.id, r.datasetId);
                  }}
                >
                  <Tooltip title={t("button.deleteButton")}>
                    <DeleteIcon />
                  </Tooltip>
                </Button>
              </Space>
            ) : (
              <CopyPublicDatasetModalButton
                datasetId={r.datasetId}
                datasetName={datasetName}
                datasetVersionId={r.id}
                cluster={cluster}
                data={r}
              >
                <Tooltip title={t("button.copyButton")}>
                  <CopyIcon />
                </Tooltip>
              </CopyPublicDatasetModalButton>
            );
          },
        },
      ]}
    />
  );
};


