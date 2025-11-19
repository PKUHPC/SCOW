"use client";

import { ExclamationCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TRPCClientError } from "@trpc/client";
import { App, Button, Form, Input, Select, Space, Table, Tag, Tooltip } from "antd";
import NextError from "next/error";
import { useState } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CancleShareIcon, CopyIcon, DeleteIcon, EditIcon, ShareIcon } from "src/icons/operationIcon";
import { getImageTexts, getImageTypeText, ImageType, Status } from "src/models/Image";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { CopyImageModal } from "./CopyImageModal";
import { CreateEditImageModal } from "./CreateEditImageModal";
import { ImageQuota } from "./ImageQuota";


interface Props {
  isPublic: boolean;
  clusters: Cluster[];
  currentClusterIds: string[];
}

interface FilterForm {
  cluster?: Cluster | undefined,
  nameOrTagOrDesc?: string | undefined,
  isShared?: boolean,
  types: ImageType[],
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const CreateImageModalButton = ModalButton(CreateEditImageModal, { type: "primary", icon: <PlusOutlined /> });
const EditImageModalButton = ModalLink(CreateEditImageModal);
const CopyImageModalButton = ModalLink(CopyImageModal);

export const ImageListTable: React.FC<Props> = ({ isPublic, clusters, currentClusterIds }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.imageListTable.");
  const languageId = useI18n().currentLanguage.id;

  const sourceText = {
    INTERNAL: getImageTexts(t).INTERNAL,
    EXTERNAL: getImageTexts(t).EXTERNAL,
  };

  const TypeText = getImageTypeText(t);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      cluster: undefined,
      nameOrTagOrDesc: undefined,
      isPublic: isPublic,
      types:[],
    };
  });

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });

  const cluster = Form.useWatch("cluster", form);

  const { data, refetch, isFetching, error } = trpc.image.list.useQuery({
    ...pageInfo,
    ...query,
    isPublic: parseBooleanParam(isPublic),
    clusterId: cluster?.id,
    types:query.types.join(","),
  });

  const { data: imageQuota, refetch: refetchImageQuota } = trpc.image.getImageQuota.useQuery();

  const { modal, message } = App.useApp();

  if (error) {
    return (
      <NextError
        title={error.message}
        statusCode={error.data?.httpStatus ?? 500}
      />
    );
  }

  const deleteImageMutation = trpc.image.deleteImage.useMutation({
    onSuccess: () => {
      message.success(t(p("delSuccess")));
      refetch();
      refetchImageQuota();
    },
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else {
        message.error(err.message);
      }
    },
  });

  const shareOrUnshareMutation = trpc.image.shareOrUnshareImage.useMutation({
    onError: (err) => {
      const { data } = err as TRPCClientError<AppRouter>;
      if (data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else {
        message.error(t(p("shareFailed")));
      }
    },
  });

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { nameOrTagOrDesc,types } = await form.validateFields();
            setQuery({ ...query, nameOrTagOrDesc: nameOrTagOrDesc?.trim(),types });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
            refetch();
            refetchImageQuota();
          }}
        >
          <Form.Item label={t(p("cluster"))} name="cluster">
            <SingleClusterSelector
              allowClear={true}
            />
          </Form.Item>
          <Form.Item label={t(p("type"))} name="types">
            <Select
              style={{ minWidth: "100px" }}
              mode="multiple"
              allowClear
              options={
                Object.entries(TypeText).map(([key, value]) => ({ label:value, value:key }))}
            />
          </Form.Item>
          <Form.Item name="nameOrTagOrDesc">
            <Input allowClear placeholder={t(p("nameOrTagOrDesc"))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{t("button.searchButton")}</Button>
          </Form.Item>
        </Form>
        {!isPublic && (
          <Space>
            <CreateImageModalButton
              refetch={refetch}
              isEdit={false}
              clusters={clusters}
              currentClusterIds={currentClusterIds}
            > {t("button.addButton")}
            </CreateImageModalButton>
          </Space>
        )}
      </FilterFormContainer>
      {
        !isPublic && (
          <ImageQuota
            usedGiB={imageQuota ? imageQuota.usedGB : "-"}
            totalGiB={imageQuota && imageQuota.totalGB !== -1 ? imageQuota.totalGB : "-"}
          />
        )
      }
      <Table
        rowKey="id"
        dataSource={data?.items}
        loading={isFetching}
        columns={[
          { dataIndex: "name", title: t(p("name")) },
          { dataIndex: "tag", title: t(p("tag")) },
          { dataIndex: "clusterId", title: t(p("cluster")),
            render: (_, r) =>
              getI18nConfigCurrentText(clusters.find((x) => (x.id === r.clusterId))?.name, languageId) ?? r.clusterId },
          { dataIndex: "types", title: t(p("type")), render: (_, r) => r.types.map((t) => <Tag>{TypeText[t]}</Tag>) },
          { dataIndex: "source", title: t(p("source")),render: (_, r) => sourceText[r.source] },
          { dataIndex: "description", title: t(p("description")) },
          isPublic ? { dataIndex: "shareUser", title: t(p("shareUser")),
            render: (_, r) => r.owner } : {},
          { dataIndex: "status", title: t(p("status")),
            render: (_, r) => {
              switch (r.status) {
                case Status.CREATING:
                  return <Tag color="processing">{t(p("processing"))}</Tag>;
                case Status.CREATED:
                  return <Tag color="success">{t(p("success"))}</Tag>;
                default:
                  return r.failedReason ? (
                    <Tooltip title={r.failedReason}>
                      <Space>
                        <Tag color="error">{t(p("error"))}</Tag>
                        <ExclamationCircleOutlined />
                      </Space>
                    </Tooltip>
                  ) : (
                    <Tag color="error">{t(p("error"))}</Tag>
                  );

              }
            },
          },
          { dataIndex: "createTime", title: t(p("createTime")),
            render: (_, r) => r.createTime ? formatDateTime(r.createTime) : "-" },
          { dataIndex: "action", title: t(p("action")),
            render: (_, r) => {
              const shareOrUnshareStr = r.isShared ? t(p("cancelShare")) : t(p("share"));
              return !isPublic ?
                (
                  <Space direction="horizontal">
                    { r.status === Status.CREATED && (
                      <EditImageModalButton
                        refetch={refetch}
                        isEdit={true}
                        editData={r}
                        clusters={clusters}
                        currentClusterIds={currentClusterIds}
                      >
                        <Tooltip title={t("button.editButton")}>
                          <EditIcon />
                        </Tooltip>
                      </EditImageModalButton>
                    )}
                    { r.status === Status.CREATED && (
                      <Tooltip title={shareOrUnshareStr}>
                        <span onClick={() => {
                          modal.confirm({
                            title: `${shareOrUnshareStr}${t(p("image"))}`,
                            content: `${t(p("confirmText"),[shareOrUnshareStr,r.name,r.tag])}`,
                            onOk: async () => {
                              await shareOrUnshareMutation.mutateAsync({
                                id: r.id,
                                share: !r.isShared,
                              }, {
                                onSuccess() {
                                  refetch();
                                  message.success(`${shareOrUnshareStr}${t(p("imageSuccessfully"))}`);
                                },
                              });
                            },
                          });
                        }}
                        >
                          { r.isShared ? <CancleShareIcon /> : <ShareIcon />}
                        </span>
                      </Tooltip>
                    )}
                    {/* { r.source === Source.INTERNAL && (
                    <Space split={<Divider type="vertical" />}>
                      <Button
                        type="link"
                        onClick={() => {
                          router.push(`/files/${r.clusterId}${r.sourcePath}`);
                        }}
                      >
                  查看文件
                      </Button>
                    </Space>
                  )} */}
                    <Tooltip title={t("button.deleteButton")}>
                      <DeleteIcon onClick={() => {
                        modal.confirm({
                          title: t(p("delImage")),
                          content: r.status === Status.CREATING ? (
                            <p>{t(p("delText1"))}</p>
                          ) : (
                            <>
                              <p>{`${t(p("confirmDel"))}${r.name}${t(p("tag"))}${r.tag}？${t(p("delText2"))}`}</p>
                            </>
                          ),
                          onOk: async () => {
                            await deleteImageMutation.mutateAsync({
                              id: r.id,
                              force: parseBooleanParam(r.status === Status.CREATING),
                            });
                          },
                        });
                      }}
                      />
                    </Tooltip>
                  </Space>
                ) :
                (
                  <CopyImageModalButton
                    refetch={refetch}
                    imageProps={
                      {
                        copiedId:r.id,
                        copiedName: r.name,
                        copiedTag: r.tag,
                        copiedClusterId: r.clusterId,
                        copiedTypes: r.types,
                        copiedInferServicePort: Number(r.inferServicePort) ,
                        copiedStartCommand: r.startCommand,
                        copiedDescription: r.description,
                      }
                    }
                  >
                    <Tooltip title={t("button.copyButton")}>
                      <CopyIcon />
                    </Tooltip>
                  </CopyImageModalButton>
                );
            },
          },
        ]}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: 10,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.count,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
        scroll={{ x: true }}
      />
    </div>
  );
};

