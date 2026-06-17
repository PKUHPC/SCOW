import { AppRouterStyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { TRPCClientError } from "@trpc/client";
import { App, Space, Table, Tooltip } from "antd";
import { ModalFuncProps } from "antd";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { CreateEditDSVersionModal } from "src/components/assets/dataset/CreateEditDSVersionModal";
import { ExpandedTableContainer } from "src/components/assets/ExpandedTableContainer";
import { VersionShareAction } from "src/components/assets/VersionShareAction";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CopyIcon, DeleteIcon, EditIcon, ViewFileIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";
import { Cluster } from "src/server/trpc/route/config";
import { DatasetInterface } from "src/server/trpc/route/dataset/dataset";
import { AppRouter } from "src/server/trpc/router";
import { getSharedStatusText, getSharedStatusUpperText } from "src/utils/common";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { CopyPublicDatasetModal } from "./CopyPublicDatasetModal";

export interface Props {
  datasets: DatasetInterface[];
  datasetId: number;
  datasetName: string;
  isPublic?: boolean;
  cluster: Cluster;
}

const CopyPublicDatasetModalButton = ModalLink(CopyPublicDatasetModal);

export const DatasetVersionList: React.FC<Props> = ({ datasets, datasetId, datasetName, isPublic, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.dataset.datasetVersionList.");
  const pCommon = prefix("app.common.");
  const { publicConfig } = usePublicConfig();
  const isUserShareEnabled = publicConfig.AI_USER_SHARE_ENABLED;

  const { message } = App.useApp();
  const CreateEditVersionModalButton = ModalLink(CreateEditDSVersionModal);

  const router = useRouter();

  const {
    data: versionData,
    isFetching,
    refetch,
    error: versionError,
  } = trpc.dataset.versionList.useQuery({
    datasetId,
    isPublic: isPublic !== undefined ? parseBooleanParam(isPublic) : undefined,
  });
  if (versionError) {
    message.error(t(p("notFound")));
  }

  useEffect(() => {
    refetch();
  }, [datasets]);

  const checkFileExist = trpc.file.checkFileExist.useMutation({
    onError: (error) => {
      message.error(`${t("app.common.fileCheckError")}： ${error.message}`);
    },
  });

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

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    title?: string;
    id?: number;
    datasetId?: number;
  }>({ open: false });

  const [shareConfirm, setShareConfirm] = useState<{
    open: boolean;
    title?: React.ReactNode;
    content?: React.ReactNode;
    onOk?: () => Promise<void> | void;
  }>({ open: false });

  const confirmWithStyledModal = useCallback((config: ModalFuncProps) => {
    setShareConfirm({
      open: true,
      title: config.title,
      content: config.content,
      onOk: async () => {
        await config.onOk?.();
        setShareConfirm({ open: false });
      },
    });
  }, []);

  const deleteDatasetVersion = (id: number, datasetId: number, isConfirmed?: boolean) => {
    setDeleteConfirm({ open: true, title: isConfirmed ? t(p("confirmedText")) : t(p("delete")), id, datasetId });
  };

  const shareConfirmLoading = shareMutation.isPending || unShareMutation.isPending;

  return (
    <ExpandedTableContainer>
      <Table
        rowKey="id"
        dataSource={versionData?.items ?? []}
        loading={isFetching}
        pagination={false}
        tableLayout="fixed"
        scroll={{ y: 275 }}
        columns={[
          { dataIndex: "versionName", title: t(p("versionName")), width: isPublic ? "25%" : "20%" },
          { dataIndex: "versionDescription", title: t(p("versionDescription")), width: isPublic ? "25%" : "20%" },
          ...(isPublic ? [] : [{ dataIndex: "privatePath", title: t(p("path")), width: "26%" }]),
          {
            dataIndex: "updateTime",
            title: t(p("updatedTime")),
            width: isPublic ? "25%" : "18%",
            render: (_, r) => (r.updateTime ? formatDateTime(r.updateTime) : "-"),
          },
          {
            dataIndex: "action",
            title: t(p("action")),
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
                    isPlatformOwned={false}
                  >
                    <Tooltip title={t("button.editButton")}>
                      <EditIcon />
                    </Tooltip>
                  </CreateEditVersionModalButton>
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
                            deleteDatasetVersion(r.id, r.datasetId, true);
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
                        confirmTitle={r.sharedStatus === SharedStatus.SHARED ? t(p("cancelShareTitle")) : t(p("share"))}
                        confirmContent={`${t(p("confirmed"), [t(pCommon(getSharedStatusText(r.sharedStatus))), r.versionName])}`}
                        confirmAction={confirmWithStyledModal}
                        onShare={async () => {
                          await shareMutation.mutateAsync({
                            datasetVersionId: r.id,
                            datasetId: r.datasetId,
                          });
                        }}
                        onUnshare={async () => {
                          await unShareMutation.mutateAsync({
                            datasetVersionId: r.id,
                            datasetId: r.datasetId,
                          });
                        }}
                      />
                    </Tooltip>
                  ) : null}

                  <Tooltip title={t("button.deleteButton")}>
                    <DeleteIcon
                      onClick={() => {
                        deleteDatasetVersion(r.id, r.datasetId);
                      }}
                    />
                  </Tooltip>
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
      {/* 分享/取消分享确认弹窗 */}
      <AppRouterStyledModal
        title={shareConfirm.title}
        open={shareConfirm.open}
        onOk={async () => {
          await shareConfirm.onOk?.();
        }}
        onCancel={() => {
          if (!shareConfirmLoading) {
            setShareConfirm({ open: false });
          }
        }}
        confirmLoading={shareConfirmLoading}
        cancelButtonProps={{ disabled: shareConfirmLoading }}
        destroyOnClose
      >
        {shareConfirm.content}
      </AppRouterStyledModal>

      {/* 删除版本确认弹窗 */}
      <AppRouterStyledModal
        title={deleteConfirm.title}
        open={deleteConfirm.open}
        onOk={async () => {
          if (deleteConfirm.id != null && deleteConfirm.datasetId != null) {
            await deleteMutation.mutateAsync({
              datasetVersionId: deleteConfirm.id,
              datasetId: deleteConfirm.datasetId,
            });
          }
          setDeleteConfirm({ open: false });
        }}
        onCancel={() => setDeleteConfirm({ open: false })}
        confirmLoading={deleteMutation.isPending}
        destroyOnClose
      />
    </ExpandedTableContainer>
  );
};
