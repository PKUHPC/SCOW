import { TRPCClientError } from "@trpc/client";
import { App, Modal, Space,Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CancleShareIcon,CopyIcon, DeleteIcon, EditIcon, ShareIcon, ViewFileIcon } from "src/icons/operationIcon";
import { AlgorithmInterface } from "src/models/Algorithm";
import { SharedStatus } from "src/models/common";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { getSharedStatusText, getSharedStatusUpperText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { CopyPublicAlgorithmModal } from "./CopyPublicAlgorithmModal";
import { CreateAndEditVersionModal } from "./CreateAndEditVersionModal";

export interface Props {
  isPublic?: boolean;
  algorithms: AlgorithmInterface[];
  algorithmId: number;
  algorithmName: string | undefined;
  cluster: Cluster;
}

const EditVersionModalButton = ModalLink(CreateAndEditVersionModal);
const CopyPublicAlgorithmModalButton = ModalLink(CopyPublicAlgorithmModal);

export const AlgorithmVersionList: React.FC<Props> = (
  { isPublic, algorithms, algorithmId, algorithmName, cluster },
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
      isPublic: isPublic !== undefined ? parseBooleanParam(isPublic) : undefined,
    });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [algorithms]);

  const checkFileExist = trpc.file.checkFileExist.useMutation({
    onError: (error) => {
      message.error(`${t("app.common.fileCheckError")}： ${error.message}`);
    },
  });

  const shareMutation = trpc.algorithm.shareAlgorithmVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("submitShare")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthShare")));
        return;
      }

      message.error(t(p("shareFailed")));
    },
  });

  const unShareMutation = trpc.algorithm.unShareAlgorithmVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelShare")));
    },
    onError(err) {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthCancel")));
        return;
      }

      message.error(t(p("cancelShareFailed")));
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
    (id: number, isConfirmed?: boolean) => {
      confirm({
        title: isConfirmed ? t(p("confirmedText")) : t(p("delete")),
        onOk:async () => {
          await deleteAlgorithmVersionMutation.mutateAsync({ algorithmVersionId: id, algorithmId });
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
          { dataIndex: "createTime", title: t(p("createTime")), render:(createTime) => formatDateTime(createTime) },
          { dataIndex: "action", title: t(p("action")),
            ...isPublic ? {} : { width: 350 },
            render: (_, r) => {
              return isPublic ? (
                <CopyPublicAlgorithmModalButton
                  data={r}
                  algorithmId={algorithmId}
                  algorithmName={algorithmName}
                  algorithmVersionId={r.id}
                  cluster={cluster}
                >
                  <Tooltip title={t("button.copyButton")}>
                    <CopyIcon />
                  </Tooltip>
                </CopyPublicAlgorithmModalButton>
              ) :
                (
                  <Space direction="horizontal">
                    <EditVersionModalButton
                      algorithmId={algorithmId}
                      algorithmName={algorithmName}
                      refetch={refetch}
                      cluster={cluster}
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
                        try {
                          const checkExistRes =
                            await checkFileExist.mutateAsync({ clusterId:cluster.id, path:r.privatePath });
                          if (checkExistRes?.exists) {
                            router.push(`/files${r.privatePath}?cluster=${cluster.id}`);
                          } else {
                            deleteAlgorithmVersion(r.id, true);
                          }
                        } catch {
                          // onError 已经处理了 UI 提示
                          return null;
                        }
                      }}
                      />
                    </Tooltip>
                    <Tooltip title={t(pCommon(getSharedStatusUpperText(r.sharedStatus)))}>
                      {(r.sharedStatus === SharedStatus.SHARED || r.sharedStatus === SharedStatus.UNSHARING) ? (
                        <CancleShareIcon
                          disabled={r.sharedStatus === SharedStatus.UNSHARING}
                          onClick={() => {
                            if (r.sharedStatus !== SharedStatus.UNSHARING) {
                              confirm({
                                title: t(p("share")),
                                content:
                          `${t(p("confirmed"),[t(pCommon(getSharedStatusText(r.sharedStatus))),r.versionName])}`,
                                onOk: async () => {
                                  if (r.sharedStatus === SharedStatus.SHARED) {
                                    await unShareMutation.mutateAsync({
                                      algorithmVersionId: r.id,
                                      algorithmId,
                                    });
                                  } else {
                                    await shareMutation.mutateAsync({
                                      algorithmVersionId: r.id,
                                      algorithmId,
                                    });
                                  }
                                },
                              });
                            }
                          }}
                        />
                      ) : (
                        <ShareIcon
                          disabled={r.sharedStatus === SharedStatus.SHARING}
                          onClick={() => {
                            if (r.sharedStatus !== SharedStatus.SHARING) {
                              confirm({
                                title: t(p("share")),
                                content:
                          `${t(p("confirmed"),[t(pCommon(getSharedStatusText(r.sharedStatus))),r.versionName])}`,
                                onOk: async () => {
                                  if (r.sharedStatus === SharedStatus.SHARED) {
                                    await unShareMutation.mutateAsync({
                                      algorithmVersionId: r.id,
                                      algorithmId,
                                    });
                                  } else {
                                    await shareMutation.mutateAsync({
                                      algorithmVersionId: r.id,
                                      algorithmId,
                                    });
                                  }
                                },
                              });
                            }
                          }}
                        />
                      )}
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
