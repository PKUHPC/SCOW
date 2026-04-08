import { TRPCClientError } from "@trpc/client";
import { App, Modal, Space,Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { CreateAndEditVersionModal } from "src/components/assets/algorithm/CreateAndEditVersionModal";
import { VersionShareAction } from "src/components/assets/VersionShareAction";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancelPublishIcon, DeleteIcon, EditIcon, PublishIcon, ViewFileIcon } from "src/icons/operationIcon";
import { AlgorithmInterface } from "src/models/Algorithm";
import { SharedStatus } from "src/models/common";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { getPublishStatusText, getPublishStatusUpperText, statusColors,
  transformPublishStatusText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

export interface Props {
  algorithms: AlgorithmInterface[];
  algorithmId: number;
  algorithmName: string | undefined;
  cluster: Cluster;
}

const EditVersionModalButton = ModalLink(CreateAndEditVersionModal);

export const AlgorithmVersionList: React.FC<Props> = (
  { algorithms, algorithmId, algorithmName, cluster },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.algorithm.algorithmVersionList.");
  const pCommon = prefix("app.common.");

  const { message } = App.useApp();
  const [{ confirm }, confirmModalHolder] = Modal.useModal();
  const router = useRouter();

  const { data: versionData, isFetching, refetch, error: versionError } =
    trpc.algorithm.getAlgorithmVersions.useQuery({
      algorithmId:algorithmId,
      isPublic: "false",
    });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [algorithms]);

  const checkFileExist = trpc.file.checkFileExist.useMutation();

  const shareMutation = trpc.algorithm.shareAlgorithmVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("submitPublish")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (err.message === "Access denied to algorithm version files; publishing is not allowed.") {
        message.error(t(p("noAccessPublish")));
        return;
      }
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthPublish")));
        return;
      }

      message.error(t(p("publishFailed")));
    },
  });

  const unShareMutation = trpc.algorithm.unShareAlgorithmVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelPublish")));
    },
    onError(err) {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthCancel")));
        return;
      }

      message.error(t(p("cancelPublishFailed")));
    },
  });

  const deleteAlgorithmVersionMutation = trpc.algorithm.deleteAlgorithmVersion.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
    },
    onError() {
      message.error(t(p("deleteFailed")));
    } });

  const deleteAlgorithmVersion = useCallback(
    (id: number, isConfirmed?: boolean, isUsedPath?: boolean) => {
      confirm({
        title: isConfirmed ?
          isUsedPath ? t(p("confirmedText2")) : t(p("confirmedText"))
          : t(p("delete")),
        onOk:async () => {
          await deleteAlgorithmVersionMutation.mutateAsync({
            algorithmVersionId: id,
            algorithmId,
            isPlatformOwned: true,
          });
        },
      });
    },
    [algorithmId],
  );

  return (
    <>
      <Table
        rowKey="id"
        dataSource={versionData?.items ?? []}
        loading={isFetching}
        pagination={false}
        scroll={{ y:275 }}
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
          { dataIndex: "action", title: t(p("action")),
            render: (_, r) => {
              const publishTitle = r.sharedStatus === SharedStatus.SHARED
                ? t(p("cancelPublishTitle"))
                : t(p("publish"));
              return (
                <Space direction="horizontal">
                  <EditVersionModalButton
                    algorithmId={algorithmId}
                    algorithmName={algorithmName}
                    refetch={refetch}
                    cluster={cluster}
                    isPlatformOwned={true}
                    editData={{
                      versionId:r.id,
                      versionName:r.versionName,
                      versionDescription:r.versionDescription,
                    }}
                  >
                    <Tooltip title={t("button.editButton")}>
                      <EditIcon />
                    </Tooltip>
                  </EditVersionModalButton>

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
                        deleteAlgorithmVersion(r.id, true, true);
                      } else {
                        deleteAlgorithmVersion(r.id, true);
                      }
                    }}
                    />
                  </Tooltip>
                  <Tooltip title={t(pCommon(getPublishStatusUpperText(r.sharedStatus)))}>
                    <VersionShareAction
                      sharedStatus={r.sharedStatus}
                      confirmTitle={publishTitle}
                      confirmContent={`${t(p("confirmed"), [t(pCommon(getPublishStatusText(r.sharedStatus))), r.versionName])}`}
                      confirmAction={confirm}
                      sharedIcon={CancelPublishIcon}
                      unsharedIcon={PublishIcon}
                      onShare={async () => {
                        await shareMutation.mutateAsync({
                          algorithmVersionId: r.id,
                          algorithmId,
                          isPlatformOwned: true,
                        });
                      }}
                      onUnshare={async () => {
                        await unShareMutation.mutateAsync({
                          algorithmVersionId: r.id,
                          algorithmId,
                          isPlatformOwned: true,
                        });
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t("button.deleteButton")}>
                    <DeleteIcon
                      disabled={r.sharedStatus === SharedStatus.SHARING
                            || r.sharedStatus === SharedStatus.UNSHARING}
                      onClick={() => {
                        deleteAlgorithmVersion(r.id);
                      }}
                    />
                  </Tooltip>
                </Space>
              );
            },
          },
        ]}
      />
      {/* antd中modal组件 */}
      {confirmModalHolder}
    </>
  );
};
