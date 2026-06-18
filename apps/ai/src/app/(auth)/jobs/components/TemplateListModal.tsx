"use client";

import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AppRouterStyledModal, CompactInlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Descriptions, Empty, Form, theme as antdTheme } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { EditIcon } from "src/icons/operationIcon";
import { JobType } from "src/models/Job";
import { type TemplateFormData } from "src/server/trpc/route/jobs/templates";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

export interface TemplateListModalProps {
  open: boolean;
  onClose: () => void;
  onUse: (formData: TemplateFormData, cluster: string) => void | Promise<void>;
  jobType: JobType;
  appId?: string;
}

const p = prefix("app.jobs.templateListModal.");

const ModalContentWrapper = styled.div`
  display: grid !important;
  grid-template-columns: 242px 1fr;
  grid-template-rows: minmax(440px, 1fr);
  flex-direction: unset !important;
  width: 100%;
  font-size: 14px;
`;

const TemplateListPanel = styled.div`
  background-color: ${({ theme }) => theme.palette.gray[2]};
  border-radius: 12px;
  margin: 24px 0 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
`;

const TemplateRightColumn = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const ModalFooterArea = styled.div`
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 16px 0 0;
  gap: 16px;

  .ant-btn-default {
    border-color: ${({ theme }) => theme.palette.gray[3]};
    color: ${({ theme }) => theme.palette.gray[6]};
    border-radius: 8px;
    height: 36px;
    padding: 0 24px;
  }

  .ant-btn-primary {
    border-radius: 8px;
    box-shadow: none;
    height: 36px;
    padding: 0 24px;
  }
`;

const TemplateListContainer = styled.div`
  width: 100%;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TemplateListItem = styled.div<{
  $selected: boolean;
  $hovered: boolean;
  $selectedColor: string;
}>`
  min-height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 0 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${({ $selected, $selectedColor, theme }) => ($selected ? $selectedColor : theme.palette.gray[6])};
  background: ${({ $hovered, theme }) => ($hovered ? theme.palette.gray[3] : "transparent")};
  font-size: 14px;
  cursor: pointer;
  user-select: none;
`;

const TemplateDetailPanel = styled.div`
  flex: 1;
  min-width: 0;
  padding: 40px 0 0 48px;
  display: flex;
`;

const TemplateEmptyState = styled.div`
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const DeleteConfirmText = styled.div<{ $color: string }>`
  font-size: 14px;
  color: ${({ $color }) => $color};
`;

const TemplateNameText = styled.span`
  flex: 1;
  text-align: left;
  color: inherit;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TemplateCommand = styled.div`
  margin: 0;
  font-size: 14px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
`;

export const TemplateListModal = ({ open, onClose, onUse, jobType, appId }: TemplateListModalProps) => {
  const { currentLanguage } = useI18n();
  const languageId = currentLanguage.id;
  const t = useI18nTranslateToString();
  const { message } = App.useApp();
  const { publicConfig } = usePublicConfig();
  const { CLUSTERS } = publicConfig;

  const { useToken } = antdTheme;
  const { token } = useToken();
  const theme = useTheme();

  const gray = theme.palette.gray;
  const descriptionLabelColor = gray[6];
  const descriptionContentColor = gray[8];

  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [hoveredId, setHoveredId] = useState<number | undefined>();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<number | undefined>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data, refetch, isLoading } = trpc.jobs.listTemplates.useQuery({ jobType, appId }, { enabled: open });

  const deleteMutation = trpc.jobs.deleteTemplate.useMutation({
    onSuccess: async () => {
      message.success(t(p("deleteSuccessfully")));
      setDeleteConfirmOpen(false);
      const { data: refreshed } = await refetch();
      const remaining = refreshed?.templates ?? [];
      setSelectedId(remaining.length > 0 ? remaining[0].id : undefined);
    },
    onError: (err) => message.error(t(p("deleteFailed"), [err.message])),
  });

  const renameMutation = trpc.jobs.renameTemplate.useMutation({
    onSuccess: () => {
      message.success(t(p("renameSuccessfully")));
      setRenameModalOpen(false);
      setRenamingId(undefined);
      void refetch();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        message.error(t(p("renameConflict")));
      } else {
        message.error(t(p("renameFailed"), [err.message]));
      }
    },
  });

  const templates = data?.templates ?? [];

  useEffect(() => {
    if (open) {
      setSelectedId(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (templates.length > 0 && selectedId === undefined) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  const selectedTemplate = useMemo(() => templates.find((tmpl) => tmpl.id === selectedId), [templates, selectedId]);

  const [useLoading, setUseLoading] = useState(false);

  const handleUse = async () => {
    if (selectedTemplate) {
      setUseLoading(true);
      try {
        await onUse(selectedTemplate.formData, selectedTemplate.cluster);
      } finally {
        setUseLoading(false);
      }
    }
  };

  const openRenameModal = (id: number) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setRenamingId(id);
    setRenameValue(template.templateName);
    setRenameModalOpen(true);
  };

  const renamingOriginalName = useMemo(
    () => templates.find((item) => item.id === renamingId)?.templateName ?? "",
    [templates, renamingId],
  );

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (!renamingId || !trimmed) return;
    if (trimmed === renamingOriginalName) {
      message.success(t(p("renameSuccessfully")));
      setRenameModalOpen(false);
      setRenamingId(undefined);
      return;
    }
    renameMutation.mutate({ id: renamingId, newName: trimmed });
  };

  const handleRenameCancel = () => {
    setRenameModalOpen(false);
    setRenamingId(undefined);
  };

  const openDeleteConfirmModal = () => {
    if (!selectedTemplate) return;
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (!selectedTemplate) return;
    deleteMutation.mutate({ id: selectedTemplate.id });
  };

  const handleDeleteCancel = () => {
    if (deleteMutation.isPending) return;
    setDeleteConfirmOpen(false);
  };

  const buildDescriptionItems = () => {
    if (!selectedTemplate) return [];
    const fd = selectedTemplate.formData;
    const items: { key: string; label: string; children: React.ReactNode }[] = [];

    if (fd.account) items.push({ key: "account", label: t(p("detailAccount")), children: String(fd.account) });
    const clusterConfig = CLUSTERS.find((c) => c.id === selectedTemplate.cluster);
    const clusterName = clusterConfig
      ? getI18nConfigCurrentText(clusterConfig.name, languageId)
      : selectedTemplate.cluster;
    items.push({ key: "cluster", label: t(p("detailCluster")), children: clusterName });

    if (fd.partition) items.push({ key: "partition", label: t(p("detailPartition")), children: String(fd.partition) });
    if (fd.qos) items.push({ key: "qos", label: t(p("detailQos")), children: String(fd.qos) });
    if ("nodeCount" in fd && fd.nodeCount) {
      items.push({ key: "nodeCount", label: t(p("detailNodeCount")), children: String(fd.nodeCount) });
    }
    if (fd.coreCount) items.push({ key: "coreCount", label: t(p("detailCoreCount")), children: String(fd.coreCount) });
    if (fd.gpuCount) items.push({ key: "gpuCount", label: t(p("detailGpuCount")), children: String(fd.gpuCount) });

    if ("maxTimeUnlimited" in fd && fd.maxTimeUnlimited) {
      items.push({ key: "maxTime", label: t(p("detailMaxTime")), children: t(p("detailUnlimitedTime")) });
    } else if ("maxTime" in fd && fd.maxTime != null) {
      const unit = "maxTimeUnit" in fd ? fd.maxTimeUnit : undefined;
      const unitLabel =
        unit === "min" ? t(p("detailMinutes")) : unit === "day" ? t(p("detailDays")) : t(p("detailHours"));
      items.push({ key: "maxTime", label: t(p("detailMaxTime")), children: `${fd.maxTime} ${unitLabel}` });
    }
    if ("maxTimeMinutes" in fd && fd.maxTimeMinutes != null) {
      items.push({
        key: "maxTimeMinutes",
        label: t(p("detailMaxTime")),
        children: `${fd.maxTimeMinutes} ${t(p("detailMinutes"))}`,
      });
    }
    const commandValue = ("command" in fd ? fd.command : undefined) ?? ("startCommand" in fd ? fd.startCommand : undefined);
    if (commandValue) {
      items.push({
        key: "command",
        label: t(p("detailCommand")),
        children: <TemplateCommand>{String(commandValue)}</TemplateCommand>,
      });
    }

    return items;
  };

  return (
    <>
      <AppRouterStyledModal
        open={open}
        centered
        title={<span style={{ fontSize: 16 }}>{t(p("title"))}</span>}
        onCancel={onClose}
        destroyOnClose
        getContainer={false}
        width={865}
        styles={{ body: { padding: 0 } }}
        footer={null}
      >
        <ModalContentWrapper>
          <TemplateListPanel>
            <TemplateListContainer>
              {templates.map((template) => {
                const selected = selectedId === template.id;
                const hovered = hoveredId === template.id;

                return (
                  <TemplateListItem
                    key={template.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(template.id)}
                    onMouseEnter={() => setHoveredId(template.id)}
                    onMouseLeave={() => setHoveredId(undefined)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(template.id);
                      }
                    }}
                    $selected={selected}
                    $hovered={hovered}
                    $selectedColor={token.colorPrimary}
                  >
                    <Tooltip title={template.templateName} arrow={false}>
                      <TemplateNameText>{template.templateName}</TemplateNameText>
                    </Tooltip>
                    <span
                      role="button"
                      tabIndex={selected || hovered ? 0 : -1}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRenameModal(template.id);
                      }}
                      style={{
                        display: "inline-flex",
                        cursor: selected || hovered ? "pointer" : "default",
                        opacity: selected || hovered ? 1 : 0,
                        pointerEvents: selected || hovered ? "auto" : "none",
                      }}
                    >
                      <EditIcon />
                    </span>
                  </TemplateListItem>
                );
              })}
            </TemplateListContainer>
          </TemplateListPanel>
          <TemplateRightColumn>
            <TemplateDetailPanel>
              {selectedTemplate ? (
                <Descriptions
                  column={1}
                  colon
                  labelStyle={{ width: 160, color: descriptionLabelColor, fontSize: 14, paddingBottom: 2 }}
                  contentStyle={{ color: descriptionContentColor, fontSize: 14, paddingBottom: 2 }}
                  items={buildDescriptionItems()}
                />
              ) : (
                <TemplateEmptyState>
                  <Empty description={isLoading ? t(p("loading")) : t(p("empty"))} />
                </TemplateEmptyState>
              )}
            </TemplateDetailPanel>
            <ModalFooterArea>
              <Button style={{ fontSize: 14 }} onClick={openDeleteConfirmModal} disabled={!selectedTemplate}>
                {t(p("delete"))}
              </Button>
              <Button style={{ fontSize: 14 }} type="primary" loading={useLoading} onClick={handleUse} disabled={!selectedTemplate}>
                {t(p("use"))}
              </Button>
            </ModalFooterArea>
          </TemplateRightColumn>
        </ModalContentWrapper>
      </AppRouterStyledModal>
      <AppRouterStyledModal
        open={renameModalOpen}
        title={t(p("rename"))}
        onCancel={handleRenameCancel}
        onOk={handleRenameConfirm}
        okText={t(p("confirmRename"))}
        cancelText={t(p("cancelRename"))}
        confirmLoading={renameMutation.isPending}
        okButtonProps={{ disabled: !renameValue.trim() }}
        centered
        styles={{ body: { paddingBottom: 42 } }}
        closable={false}
      >
        <Form requiredMark={false} colon={false}>
          <CompactInlineFormItem label={<FormLabel>{t(p("renameLabel"))}</FormLabel>} style={{ marginBottom: 0 }}>
            <RoundedInput
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              onPressEnter={handleRenameConfirm}
            />
          </CompactInlineFormItem>
        </Form>
      </AppRouterStyledModal>
      <AppRouterStyledModal
        open={deleteConfirmOpen}
        title={t(p("delete"))}
        onCancel={handleDeleteCancel}
        onOk={handleDelete}
        okText={t(p("confirmDelete"))}
        cancelText={t(p("cancel"))}
        confirmLoading={deleteMutation.isPending}
        okButtonProps={{ disabled: !selectedTemplate }}
        width={480}
        centered
        styles={{ body: { paddingBottom: 42 } }}
        closable={false}
      >
        <DeleteConfirmText $color={descriptionLabelColor}>{t(p("deleteConfirm"))}</DeleteConfirmText>
      </AppRouterStyledModal>
    </>
  );
};
