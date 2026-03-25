import { TRPCClientError } from "@trpc/client";
import { App, Modal, Space,Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { CreateAndEditVersionModal } from "src/components/assets/model/CreateAndEditVersionModal";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancelPublishIcon, DeleteIcon, EditIcon, PublishIcon, ViewFileIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";
import { ModelInterface } from "src/models/Model";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { getPublishStatusText, getPublishStatusUpperText, statusColors,
  transformPublishStatusText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

export interface Props {
  models: ModelInterface[];
  modelId: number;
  modelName: string;
  cluster: Cluster;
}

const EditVersionModalButton = ModalLink(CreateAndEditVersionModal);

export const ModelVersionList: React.FC<Props> = (
  { models, modelId, modelName, cluster },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.modelVersionList.");
  const pCommon = prefix("app.common.");

  const { message } = App.useApp();
  const [{ confirm }, confirmModalHolder] = Modal.useModal();
  const router = useRouter();

  const { data: versionData, isFetching, refetch, error: versionError } =
    trpc.model.versionList.useQuery({
      modelId,
      isPublic: "false",
    });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [models]);

  const checkFileExist = trpc.file.checkFileExist.useMutation();

  const shareMutation = trpc.model.shareModelVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("submitPublish")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (err.message === "Access denied to model version files; publishing is not allowed.") {
        message.error(t(p("noAccessPublish")));
        return;
      }
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthPublish")));
        return;
      }

      message.error(err.message);
    },
  });

  const unShareMutation = trpc.model.unShareModelVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelPublish")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthCancel")));
        return;
      }

      message.error(t(p("publishFailed")));
    },
  });

  const deleteModelVersionMutation = trpc.model.deleteModelVersion.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
    },
    onError() {
      message.error(t(p("deleteFailed")));
    } });

  const deleteModelVersion = useCallback(
    (versionId: number, isConfirmed?: boolean, isUsedPath?: boolean) => {
      confirm({
        title: isConfirmed ?
          isUsedPath ? t(p("confirmedText2")) : t(p("confirmedText"))
          : t(p("delete")),
        onOk:async () => {
          await deleteModelVersionMutation.mutateAsync({ versionId, modelId, isPlatformOwned: true });
        },
      });
    },
    [modelId],
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
          { dataIndex: "algorithmVersion", title: t(p("algorithmVersion")) },
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
                    modelId={modelId}
                    modelName={modelName}
                    cluster={cluster}
                    refetch={refetch}
                    isPlatformOwned={true}
                    editData={{
                      versionId:r.id,
                      versionName:r.versionName,
                      versionDescription:r.versionDescription,
                      algorithmVersion:r.algorithmVersion,
                    }}

                  >
                    <Tooltip title={t("button.editButton")}>
                      <EditIcon />
                    </Tooltip>
                  </EditVersionModalButton>
                  <Tooltip title={t(p("check"))}>
                    <ViewFileIcon onClick={async () => {
                      const checkExistRes =
                        await checkFileExist.mutateAsync({
                          clusterId:cluster.id,
                          path:r.privatePath,
                          isPlatformOwned:true,
                        });

                      if (checkExistRes?.exists) {
                        router.push(`/files${r.privatePath}`);
                      } else if (checkExistRes?.existsForUsedPath) {
                        deleteModelVersion(r.id, true, true);
                      } else {
                        deleteModelVersion(r.id, true);
                      }
                    }}
                    />
                  </Tooltip>
                  <Tooltip title={t(pCommon(getPublishStatusUpperText(r.sharedStatus)))}>
                    <span onClick={() => {
                      if (r.sharedStatus !== SharedStatus.SHARING && r.sharedStatus !== SharedStatus.UNSHARING) {
                        confirm({
                          title: publishTitle,
                          content:
                          `${t(p("confirmed"),[t(pCommon(getPublishStatusText(r.sharedStatus))),r.versionName])}`,
                          onOk: async () => {
                            if (r.sharedStatus === SharedStatus.SHARED) {

                              await unShareMutation.mutateAsync({
                                versionId: r.id,
                                modelId,
                                isPlatformOwned: true,
                              });
                            } else {
                              await shareMutation.mutateAsync({
                                versionId: r.id,
                                modelId,
                                isPlatformOwned: true,
                              });
                            }
                          },
                        });
                      }
                    }}
                    >
                      {(r.sharedStatus === SharedStatus.SHARED || r.sharedStatus === SharedStatus.UNSHARING) ? (
                        <CancelPublishIcon
                          disabled={r.sharedStatus === SharedStatus.UNSHARING}
                        />
                      ) : (
                        <PublishIcon
                          disabled={r.sharedStatus === SharedStatus.SHARING}
                        />
                      )}
                    </span>
                  </Tooltip>
                  <Tooltip title={t("button.deleteButton")}>
                    <DeleteIcon
                      disabled={r.sharedStatus === SharedStatus.SHARING
                            || r.sharedStatus === SharedStatus.UNSHARING}
                      onClick={() => {
                        deleteModelVersion(r.id);
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
