"use client";

import { PlusOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TRPCClientError } from "@trpc/client";
import { App, Button, Form, Input, Select, Space, Table, Tag, Tooltip } from "antd";
import NextError from "next/error";
import { useState } from "react";
import { ImageCreationLogModal } from "src/app/(auth)/asset/image/ImageCreationLogModal";
import { CreateEditImageModal } from "src/components/assets/image/CreateEditImageModal";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CancelPublishIcon, DeleteIcon, EditIcon, PublishIcon } from "src/icons/operationIcon";
import { getImageTexts, getImageTypeText, ImageType, Status } from "src/models/Image";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { formatDateTime } from "src/utils/datetime";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

interface Props {
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

export const ImageListTable: React.FC<Props> = ({ clusters }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.imageListTable.");
  const pCommon = prefix("app.common.");
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
      types:[],
    };
  });

  const [form] = Form.useForm<FilterForm>();
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: 10 });

  const [showLogModal, setShowLogModal] = useState(false);
  // 存储选中的镜像
  const [selectedImage, setSelectedImage] = useState<any>(null);

  const handleOpenModal = (image: any) => {
    setSelectedImage(image);
    setShowLogModal(true);
  };
  const handleCloseModal = () => {
    setSelectedImage(null);
    setShowLogModal(false);
    refetch();
  };

  const cluster = Form.useWatch("cluster", form);

  const { data, refetch, isFetching, error } = trpc.image.list.useQuery({
    ...pageInfo,
    ...query,
    isPublic: "true", // 保留获取已发布的镜像数量
    clusterId: cluster?.id,
    types:query.types.join(","),
    isPlatformOwned: true,
  });

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
      if (err.message === "Access denied to image files; publishing is not allowed.") {
        message.error(t(p("noAccessPublish")));
        return;
      }
      if (data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else {
        message.error(t(p("publishFailed")));
      }
    },
  });

  return (
    <div>
      <FilterFormContainer style={{
        display: "flex",
        justifyContent: "space-between",
        paddingLeft: 0,
        paddingTop: 0,
        marginLeft: "-2px",
      }}
      >
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { nameOrTagOrDesc,types } = await form.validateFields();
            setQuery({ ...query, nameOrTagOrDesc: nameOrTagOrDesc?.trim(),types });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
            refetch();
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

        <Space>
          <CreateImageModalButton
            refetch={refetch}
            isEdit={false}
            clusters={clusters}
            isPlatformOwned={true}
            usePublicPath={true}
          > {t("button.addButton")}
          </CreateImageModalButton>
        </Space>

      </FilterFormContainer>
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
          { dataIndex: "status", title: t(p("status")),
            render: (_, r) => {
              switch (r.status) {
                case Status.CREATING:
                  return (
                    <>
                      <a style={{ color: "#46B600" }} onClick={() => handleOpenModal(r)}>
                        {t(p("processing"))}
                      </a>
                    </>
                  );
                case Status.CREATED:{
                  if (r.isShared) {
                    return <a style={{ color: "#5FBDEC" }}>{t(pCommon("PUBLISHED"))}</a>;
                  }
                  return <a style={{ color: "#3584D9" }}>{t(p("success"))}</a>;
                }
                default:
                  return (
                    <>
                      <a style={{ color: "#D93566" }} onClick={() => handleOpenModal(r)}>
                        {t(p("error"))}
                      </a>
                    </>
                  );
              }
            },
          },
          { dataIndex: "updateTime", title: t(p("updatedTime")),
            render: (_, r) => r.updateTime ? formatDateTime(r.updateTime) : "-" },
          { dataIndex: "action", title: t(p("action")),
            render: (_, r) => {
              const shareOrUnshareStr = r.isShared ? t(pCommon("cancelPublish")) : t(pCommon("publish"));
              return (
                <Space direction="horizontal">
                  { r.status === Status.CREATED && (
                    <EditImageModalButton
                      refetch={refetch}
                      isEdit={true}
                      editData={r}
                      clusters={clusters}
                      isPlatformOwned={true}
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
                          title: `${shareOrUnshareStr}${languageId === "en" ? " " : ""}${t(p("image"))}`,
                          content: `${t(p("confirmText"),[shareOrUnshareStr,r.name,r.tag])}`,
                          onOk: async () => {
                            await shareOrUnshareMutation.mutateAsync({
                              id: r.id,
                              share: !r.isShared,
                              isPlatformOwned: true,
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
                        { r.isShared ? <CancelPublishIcon /> : <PublishIcon />}
                      </span>
                    </Tooltip>
                  )}
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
                            isPlatformOwned: true,
                          });
                        },
                      });
                    }}
                    />
                  </Tooltip>
                </Space>
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

      <ImageCreationLogModal
        imageId={selectedImage?.id}
        status={selectedImage?.status}
        open={showLogModal}
        onClose={() => handleCloseModal()}
        failedReason={
          selectedImage?.status === Status.FAILURE ? (selectedImage?.failedReason ?? "创建失败") : undefined}
      />
    </div>
  );
};
