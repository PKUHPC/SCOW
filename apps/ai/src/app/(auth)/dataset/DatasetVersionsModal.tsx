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
import { App, Button, Checkbox, Divider, Modal, Space, Table } from "antd";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { ModalButton } from "src/components/ModalLink";
import { DatasetVersionInterface } from "src/models/Dateset";
import { AppRouter } from "src/server/trpc/router";
import { Cluster } from "src/utils/config";
import { formatDateTime } from "src/utils/datetime";
import { trpc } from "src/utils/trpc";

import { CreateEditDSVersionModal } from "./CreateEditDSVersionModal";

export interface Props {
  open: boolean;
  onClose: () => void;
  onRefetch: () => void;
  isFetching: boolean;
  datasetName: string;
  datasetVersions: DatasetVersionInterface[];
  isPublic?: boolean;
  cluster: Cluster | undefined;
}

export const DatasetVersionsModal: React.FC<Props> = (
  { open, onClose, onRefetch, isFetching, datasetName, isPublic, cluster, datasetVersions },
) => {
  const { modal, message } = App.useApp();
  const CreateEditVersionModalButton = ModalButton(CreateEditDSVersionModal, { type: "link" });
  const [ deleteSourceFile, setDeleteSourceFile ] = useState(false);
  const deleteSourceFileRef = useRef(deleteSourceFile);

  useEffect(() => {
    deleteSourceFileRef.current = deleteSourceFile;
  }, [deleteSourceFile]);

  const router = useRouter();

  const shareMutation = trpc.dataset.shareDatasetVersion.useMutation({
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error("没有权限分享此数据集版本");
      } else {
        message.error("分享数据集版本失败");
      }
    },
  });

  const unShareMutation = trpc.dataset.unShareDatasetVersion.useMutation({
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "FORBIDDEN") {
        message.error("没有权限取消分享此数据集版本");
      } else {
        message.error("取消分享数据集版本失败");
      }
    },
  });

  const copyMutation = trpc.file.copyOrMove.useMutation({
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "CONFLICT") {
        message.error("存在相同的文件");
      } else {
        message.error("复制文件失败");
      }
    },
  });

  const deleteMutation = trpc.dataset.deleteDatasetVersion.useMutation({
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "NOT_FOUND") {
        message.error("找不到该数据集版本");
      } else {
        message.error("删除数据集版本失败");
      }
    },
  });

  const deleteSourceFileMutation = trpc.file.deleteItem.useMutation();

  return (
    <Modal
      title={`版本列表: ${datasetName}`}
      open={open}
      onCancel={onClose}
      centered
      width={1000}
      footer={false}
    >
      <Table
        rowKey="id"
        dataSource={datasetVersions}
        loading={isFetching}
        pagination={false}
        scroll={{ y:275 }}
        columns={[
          { dataIndex: "versionName", title: "版本名称" },
          { dataIndex: "versionDescription", title: "版本描述" },
          isPublic ? {} : { dataIndex: "privatePath", title: "路径" },
          { dataIndex: "createTime", title: "创建时间",
            render: (_, r) => formatDateTime(r.createTime) },
          { dataIndex: "action", title: "操作",
            render: (_, r) => {

              return !isPublic ? (
                <>
                  <Space split={<Divider type="vertical" />}>
                    <CreateEditVersionModalButton
                      key="edit"
                      datasetId={r.datasetId}
                      datasetName={datasetName}
                      cluster={cluster}
                      isEdit={true}
                      editData={r}
                      refetch={onRefetch}
                    >
                    编辑
                    </CreateEditVersionModalButton>
                  </Space>

                  <Space split={<Divider type="vertical" />}>
                    <Button
                      type="link"
                      onClick={() => {
                        router.push(`/files/${cluster?.id}${r.privatePath}`);
                      }}
                    >
                      查看文件
                    </Button>
                  </Space>

                  <Space split={<Divider type="vertical" />}>

                    <Button
                      type="link"
                      onClick={() => {
                        modal.confirm({
                          title: "分享数据集版本",
                          content: `确认${r.isShared ? "取消分享" : "分享"}数据集版本 ${r.versionName}?`,
                          onOk: async () => {
                            await new Promise<void>((resolve) => {
                              r.isShared ?
                                unShareMutation.mutate({
                                  id: r.id,
                                  datasetId: r.datasetId,
                                }, {
                                  onSuccess() {
                                    onRefetch();
                                    resolve();
                                    message.success("取消分享成功");
                                  },
                                  onError() {
                                    resolve();
                                  },
                                }) :
                                shareMutation.mutate({
                                  id: r.id,
                                  datasetId: r.datasetId,
                                  sourceFilePath: r.path,
                                // fileType: "DIR",
                                }, {
                                  onSuccess() {
                                    onRefetch();
                                    resolve();
                                    message.success("分享成功");
                                  },
                                  onError() {
                                    resolve();
                                  },
                                });
                            });

                          },
                        });
                      }}
                    >{r.isShared ? "取消分享" : "分享"}</Button>
                  </Space>

                  <Space split={<Divider type="vertical" />}>
                    <Button
                      type="link"
                      onClick={() => {
                        modal.confirm({
                          title: "删除数据集版本",
                          content: (
                            <>
                              <p>{`是否确认删除数据集${datasetName}版本${r.versionName}？如该数据集版本已分享，则分享的数据集版本也会被删除。`}</p>
                              <Checkbox
                                onChange={(e) => setDeleteSourceFile(e.target.checked)}
                              >
                                同时删除源文件
                              </Checkbox>
                            </>
                          ),
                          onOk: async () => {
                            deleteSourceFileRef.current ?
                              await Promise.all([
                                deleteMutation.mutateAsync({
                                  id: r.id,
                                  datasetId: r.datasetId,
                                }),
                                new Promise((resolve) => {
                                  setTimeout(() => {
                                    deleteSourceFileMutation.mutateAsync({
                                      target: "DIR",
                                      clusterId: cluster?.id ?? "",
                                      path: r.privatePath,
                                    }).then(resolve);
                                  }, 2000);
                                }),

                              ]).then(() => {
                                message.success("删除成功");
                                onRefetch();
                              }) :
                              await deleteMutation.mutateAsync({
                                id: r.id,
                                datasetId: r.datasetId,
                              }).then(() => {
                                message.success("删除成功");
                                onRefetch();
                              });
                          },
                        });
                      }}
                    >
                        删除
                    </Button>
                  </Space>
                </>
              ) : (
                <Space split={<Divider type="vertical" />}>
                  <Button
                    type="link"
                    onClick={() => {
                      modal.confirm({
                        title: "TODO: 选择路径",
                        onOk: async () => {
                          // todo 选择存储路径
                          await new Promise<void>((resolve) => {
                            copyMutation.mutate({
                              op: "copy",
                              clusterId: cluster?.id ?? "",
                              fromPath: r.path,
                              //  todo 选择存储路径
                              toPath: "/data/home/demo_admin/sharing/aaaa",
                            }, {
                              onSuccess() {
                                onRefetch();
                                resolve();
                                message.success("复制成功");
                              },
                              onError() {
                                resolve();
                              },
                            });
                          });
                        },
                      });
                    }}
                  >
                    复制
                  </Button>
                </Space>
              );

            },
          },
        ]}
      />
    </Modal>
  );
};