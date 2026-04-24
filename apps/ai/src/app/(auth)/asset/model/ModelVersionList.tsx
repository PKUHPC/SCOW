import { TRPCClientError } from "@trpc/client";
import { App, Modal, Space, Table, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { ExpandedTableContainer } from "src/components/assets/ExpandedTableContainer";
import { CreateAndEditVersionModal } from "src/components/assets/model/CreateAndEditVersionModal";
import { VersionShareAction } from "src/components/assets/VersionShareAction";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CopyIcon, DeleteIcon, EditIcon, ViewFileIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";
import { ModelInterface } from "src/models/Model";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { getSharedStatusText, getSharedStatusUpperText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { CopyPublicModelModal } from "./CopyPublicModelModal";

export interface Props {
  isPublic?: boolean;
  models: ModelInterface[];
  modelId: number;
  modelName: string;
  cluster: Cluster;
}

const EditVersionModalButton = ModalLink(CreateAndEditVersionModal);
const CopyPublicModelModalButton = ModalLink(CopyPublicModelModal);

export const ModelVersionList: React.FC<Props> = ({ models, isPublic, modelId, modelName, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.modelVersionList.");
  const pCommon = prefix("app.common.");
  const { publicConfig } = usePublicConfig();
  const isUserShareEnabled = publicConfig.AI_USER_SHARE_ENABLED;

  const { message } = App.useApp();
  const [{ confirm }, confirmModalHolder] = Modal.useModal();
  const router = useRouter();

  const {
    data: versionData,
    isFetching,
    refetch,
    error: versionError,
  } = trpc.model.versionList.useQuery({
    modelId,
    isPublic: isPublic !== undefined ? parseBooleanParam(isPublic) : undefined,
  });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [models]);

  const checkFileExist = trpc.file.checkFileExist.useMutation({
    onError: (error) => {
      message.error(`${t("app.common.fileCheckError")}： ${error.message}`);
    },
  });

  const shareMutation = trpc.model.shareModelVersion.useMutation({
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

      message.error(err.message);
    },
  });

  const unShareMutation = trpc.model.unShareModelVersion.useMutation({
    onSuccess() {
      refetch();
      message.success(t(p("cancelShare")));
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error(t(p("noAuthCancel")));
        return;
      }

      message.error(t(p("shareFailed")));
    },
  });

  const deleteModelVersionMutation = trpc.model.deleteModelVersion.useMutation({
    onSuccess() {
      message.success(t(p("deleteSuccessfully")));
      refetch();
    },
    onError() {
      message.error(t(p("deleteFailed")));
    },
  });

  const deleteModelVersion = useCallback(
    (versionId: number, isConfirmed?: boolean) => {
      confirm({
        title: isConfirmed ? t(p("confirmedText")) : t(p("delete")),
        onOk: async () => {
          await deleteModelVersionMutation.mutateAsync({ versionId, modelId });
        },
      });
    },
    [modelId],
  );

  return (
    <>
      <ExpandedTableContainer>
        <Table
          rowKey="id"
          dataSource={versionData?.items ?? []}
          loading={isFetching}
          pagination={false}
          tableLayout="fixed"
          scroll={{ y: 275 }}
          columns={[
            { dataIndex: "versionName", title: t(p("versionName")), width: isPublic ? "18%" : "16%" },
            { dataIndex: "versionDescription", title: t(p("versionDescription")), width: isPublic ? "22%" : "18%" },
            { dataIndex: "algorithmVersion", title: t(p("algorithmVersion")), width: isPublic ? "20%" : "18%" },
            ...(isPublic ? [] : [{ dataIndex: "privatePath", title: t(p("path")), width: "20%" }]),
            {
              dataIndex: "updateTime",
              title: t(p("updatedTime")),
              width: isPublic ? "18%" : "12%",
              render: (_, r) => (r.updateTime ? formatDateTime(r.updateTime) : "-"),
            },
            {
              dataIndex: "action",
              title: t(p("action")),
              render: (_, r) => {
                const shareConfirmTitle =
                  r.sharedStatus === SharedStatus.SHARED ? t(p("cancelShareTitle")) : t(p("share"));
                return isPublic ? (
                  <CopyPublicModelModalButton
                    modelId={modelId}
                    modelName={modelName}
                    modelVersionId={r.id}
                    data={r}
                    cluster={cluster}
                  >
                    <Tooltip title={t("button.copyButton")}>
                      <CopyIcon />
                    </Tooltip>
                  </CopyPublicModelModalButton>
                ) : (
                  <Space direction="horizontal">
                    <EditVersionModalButton
                      modelId={modelId}
                      modelName={modelName}
                      cluster={cluster}
                      refetch={refetch}
                      editData={{
                        versionId: r.id,
                        versionName: r.versionName,
                        versionDescription: r.versionDescription,
                        algorithmVersion: r.algorithmVersion,
                      }}
                    >
                      <Tooltip title={t("button.editButton")}>
                        <EditIcon />
                      </Tooltip>
                    </EditVersionModalButton>
                    <Tooltip title={t(p("check"))}>
                      <ViewFileIcon
                        onClick={async () => {
                          try {
                            const checkExistRes = await checkFileExist.mutateAsync({
                              clusterId: cluster.id,
                              path: r.privatePath,
                            });
                            if (checkExistRes?.exists) {
                              router.push(`/files${r.privatePath}?cluster=${cluster.id}`);
                            } else {
                              deleteModelVersion(r.id, true);
                            }
                          } catch {
                            // onError 已经处理了 UI 提示
                            return null;
                          }
                        }}
                      />
                    </Tooltip>
                    {isUserShareEnabled ? (
                      <Tooltip title={t(pCommon(getSharedStatusUpperText(r.sharedStatus)))}>
                        <VersionShareAction
                          sharedStatus={r.sharedStatus}
                          confirmTitle={shareConfirmTitle}
                          confirmContent={`${t(p("confirmed"), [t(pCommon(getSharedStatusText(r.sharedStatus))), r.versionName])}`}
                          confirmAction={confirm}
                          onShare={async () => {
                            await shareMutation.mutateAsync({
                              versionId: r.id,
                              modelId,
                            });
                          }}
                          onUnshare={async () => {
                            await unShareMutation.mutateAsync({
                              versionId: r.id,
                              modelId,
                            });
                          }}
                        />
                      </Tooltip>
                    ) : null}
                    <Tooltip title={t("button.deleteButton")}>
                      <DeleteIcon
                        disabled={r.sharedStatus === SharedStatus.SHARING || r.sharedStatus === SharedStatus.UNSHARING}
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
      </ExpandedTableContainer>
      {/* antd中modal组件 */}
      {confirmModalHolder}
    </>
  );
};
