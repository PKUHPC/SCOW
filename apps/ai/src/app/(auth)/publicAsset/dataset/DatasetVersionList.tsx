import { TRPCClientError } from "@trpc/client";
import { App, Space, Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { VersionShareAction } from "src/components/assets/VersionShareAction";
import { CreateEditDSVersionModal } from "src/components/assets/dataset/CreateEditDSVersionModal";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancelPublishIcon, DeleteIcon, EditIcon, PublishIcon, ViewFileIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { AppRouter } from "src/server/trpc/router";
import { getPublishStatusText, getPublishStatusUpperText, statusColors,
  transformPublishStatusText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

export interface Props {
  datasets: DatasetInterface[];
  datasetId: number;
  datasetName: string;
  cluster: Cluster;
}

export const DatasetVersionList: React.FC<Props> = (
  { datasets, datasetId, datasetName, cluster },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.datasetVersionList.");
  const pCommon = prefix("app.common.");

  const { modal, message } = App.useApp();
  const CreateEditVersionModalButton = ModalLink(CreateEditDSVersionModal);

  const router = useRouter();

  const { data: versionData, isFetching, refetch, error: versionError }
    = trpc.dataset.versionList.useQuery({
      datasetId,
      isPublic: "false",
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
      message.success(t(p("submitPublish")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (err.message === "Access denied to dataset version files; publishing is not allowed.") {
        message.error(t(p("noAccessPublish")));
      } else if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthPublish")));
      } else {
        message.error(t(p("publishFailed")));
      }
    },
  });

  const unShareMutation = trpc.dataset.unShareDatasetVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelPublish")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthPublish")));
      } else {
        message.error(t(p("cancelPublishFailed")));
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
    (id: number, datasetId: number, isConfirmed?: boolean, isUsedPath?: boolean) => {
      modal.confirm({
        title: isConfirmed ?
          isUsedPath ? t(p("confirmedText2")) : t(p("confirmedText"))
          : t(p("delete")),
        onOk: async () => {
          await deleteMutation.mutateAsync({
            datasetVersionId: id,
            datasetId,
            isPlatformOwned: true,
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
      scroll={{ y: 275 }}
      columns={[
        { dataIndex: "versionName", title: t(p("versionName")) },
        { dataIndex: "versionDescription", title: t(p("versionDescription")) },
        { dataIndex: "privatePath", title: t(p("path")) },
        {
          dataIndex: "sharedStatus", title: t(p("sharedStatus")),
          render: (status: SharedStatus) => (
            <span style={{ color: statusColors[status] }}>
              {t(pCommon(transformPublishStatusText(status)))}</span>
          ),
        },
        {
          dataIndex: "updateTime", title: t(p("updatedTime")),
          render: (_, r) => r.updateTime ? formatDateTime(r.updateTime) : "-",
        },
        {
          dataIndex: "action", title: t(p("action")),
          render: (_, r) => {
            const publishTitle = r.sharedStatus === SharedStatus.SHARED
              ? t(p("cancelPublishTitle"))
              : t(p("publish"));
            return (
              <Space direction="horizontal">
                <CreateEditVersionModalButton
                  key="edit"
                  datasetId={r.datasetId}
                  datasetName={datasetName}
                  cluster={cluster}
                  isEdit={true}
                  editData={r}
                  refetch={refetch}
                  isPlatformOwned={true}
                >
                  <Tooltip title={t("button.editButton")}>
                    <EditIcon />
                  </Tooltip>
                </CreateEditVersionModalButton>
                <Tooltip title={t(p("check"))}>
                  <ViewFileIcon onClick={async () => {
                    const checkExistRes = await checkFileExist.mutateAsync({
                      clusterId:cluster.id,
                      path:r.privatePath,
                      isPlatformOwned:true,
                    });

                    if (checkExistRes?.exists) {
                      router.push(`/files${r.privatePath}`);
                    } else if (checkExistRes?.existsForUsedPath) {
                      deleteDatasetVersion(r.id, r.datasetId, true, true);
                    } else {
                      deleteDatasetVersion(r.id, r.datasetId, true);
                    }
                  }}
                  />
                </Tooltip>
                <Tooltip title={t(pCommon(getPublishStatusUpperText(r.sharedStatus)))}>
                  <VersionShareAction
                    sharedStatus={r.sharedStatus}
                    confirmTitle={publishTitle}
                    confirmContent={`${t(p("confirmed"), [t(pCommon(getPublishStatusText(r.sharedStatus))), r.versionName])}`}
                    confirmAction={modal.confirm}
                    sharedIcon={CancelPublishIcon}
                    unsharedIcon={PublishIcon}
                    onShare={async () => {
                      await shareMutation.mutateAsync({
                        datasetVersionId: r.id,
                        datasetId: r.datasetId,
                        isPlatformOwned: true,
                      });
                    }}
                    onUnshare={async () => {
                      await unShareMutation.mutateAsync({
                        datasetVersionId: r.id,
                        datasetId: r.datasetId,
                        isPlatformOwned: true,
                      });
                    }}
                  />
                </Tooltip>

                <Tooltip title={t("button.deleteButton")}>
                  <DeleteIcon onClick={() => {
                    deleteDatasetVersion(r.id, r.datasetId);
                  }}
                  />
                </Tooltip>
              </Space>
            );
          },
        },
      ]}
    />
  );
};
