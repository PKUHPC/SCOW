import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { CompactInlineFormItem, StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Descriptions, Empty, Form, theme as antdTheme } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { EditIcon } from "src/icons/headerIcons/headerIcons";
import { TimeUnit } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { styled, useTheme } from "styled-components";

export interface TemplateListModalProps {
  open: boolean;
  onClose: () => void;
  onUse?: (payload: {
    cluster: string;
    template: Awaited<ReturnType<typeof api.getJobTemplate>>["template"];
  }) => void | Promise<void>;
  clusterIds: string[];
}

interface TemplateViewData {
  templateKey: string;
  id: string;
  name: string;
  account: string;
  cluster: string;
  partition: string;
  qos: string;
  nodeCount: string;
  cpuCoresPerNode: string;
  maxRuntime: string;
  command: string;
}

const formatMaxRuntime = (
  maxTime: number,
  maxTimeUnit: TimeUnit | undefined,
  minuteLabel: string,
  hourLabel: string,
  dayLabel: string,
): string => {
  switch (maxTimeUnit) {
    case TimeUnit.HOURS:
      return `${maxTime} ${hourLabel}`;
    case TimeUnit.DAYS:
      return `${maxTime} ${dayLabel}`;
    case TimeUnit.MINUTES:
    default:
      return `${maxTime} ${minuteLabel}`;
  }
};

const getTemplateKey = (cluster: string, id: string) => `${cluster}::${id}`;

const ModalContentWrapper = styled.div`
  display: grid;
  grid-template-columns: 242px 1fr;
  grid-template-rows: minmax(440px, 1fr);
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

const TemplateListContainer = styled.div<{ $maxHeight: number }>`
  width: 100%;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
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

const TemplateCommand = styled.div`
  margin: 0;
  font-size: 14px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
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

export const TemplateListModal: React.FC<TemplateListModalProps> = ({ open, onClose, onUse, clusterIds }) => {
  const p = prefix("pageComp.submitJobCom.templateListModal.");
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const leftListMaxHeight = 380;
  const { message } = App.useApp();

  const { useToken } = antdTheme;
  const { token } = useToken();
  const theme = useTheme();
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const gray = theme.palette.gray;
  const descriptionLabelColor = gray[6];
  const descriptionContentColor = gray[8];

  const [templates, setTemplates] = useState<TemplateViewData[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | undefined>();
  const [hoveredTemplateKey, setHoveredTemplateKey] = useState<string | undefined>();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingTemplateKey, setRenamingTemplateKey] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);

  const promiseFn = useCallback(async () => {
    if (!open || clusterIds.length === 0) {
      return [];
    }
    return await api
      .listJobTemplates({
        query: {
          clusters: clusterIds,
        },
      })
      .then((x) => x.results);
  }, [clusterIds, open]);

  const { data: templateData, isLoading, reload } = useAsync({ promiseFn });

  useEffect(() => {
    const normalizedTemplates: TemplateViewData[] = (templateData ?? []).map((template) => ({
      templateKey: getTemplateKey(template.cluster ?? "-", template.id),
      id: template.id,
      name: template.jobName ?? "-",
      account: "-",
      cluster: template.cluster ?? "-",
      partition: "-",
      qos: "-",
      nodeCount: "-",
      cpuCoresPerNode: "-",
      maxRuntime: "-",
      command: template.comment ?? "-",
    }));

    setTemplates(normalizedTemplates);
    setSelectedTemplateKey((previous) =>
      normalizedTemplates.some((item) => item.templateKey === previous)
        ? previous
        : normalizedTemplates[0]?.templateKey,
    );
  }, [templateData]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateKey === selectedTemplateKey),
    [selectedTemplateKey, templates],
  );

  const resolveTemplateCluster = useCallback(
    (cluster?: string) => {
      if (cluster && cluster !== "-") {
        return cluster;
      }
      return clusterIds.length === 1 ? clusterIds[0] : undefined;
    },
    [clusterIds],
  );

  const detailPromiseFn = useCallback(async () => {
    if (!open || !selectedTemplate?.id) {
      return undefined;
    }

    const cluster = resolveTemplateCluster(selectedTemplate.cluster);
    if (!cluster) {
      return undefined;
    }

    return await api
      .getJobTemplate({
        query: {
          cluster,
          id: selectedTemplate.id,
        },
      })
      .httpError(404, () => undefined)
      .then((res) => res?.template);
  }, [open, resolveTemplateCluster, selectedTemplate?.cluster, selectedTemplate?.id]);

  const { data: selectedTemplateDetail, isLoading: isTemplateDetailLoading } = useAsync({ promiseFn: detailPromiseFn });

  const selectedTemplateWithDetails = useMemo(() => {
    if (!selectedTemplate) {
      return undefined;
    }

    if (!selectedTemplateDetail) {
      return selectedTemplate;
    }

    return {
      ...selectedTemplate,
      account: selectedTemplateDetail.account || "-",
      partition: selectedTemplateDetail.partition || "-",
      qos: selectedTemplateDetail.qos || "-",
      nodeCount: `${selectedTemplateDetail.nodeCount}`,
      cpuCoresPerNode: `${selectedTemplateDetail.coreCount}`,
      maxRuntime: formatMaxRuntime(
        selectedTemplateDetail.maxTime,
        selectedTemplateDetail.maxTimeUnit,
        t(p("minutes")),
        t(p("hours")),
        t(p("days")),
      ),
      command: selectedTemplateDetail.command || "-",
    };
  }, [selectedTemplate, selectedTemplateDetail, t]);

  const clusterDisplayName = useMemo(() => {
    const clusterId = selectedTemplateWithDetails?.cluster;
    if (!clusterId || clusterId === "-") {
      return clusterId ?? "-";
    }
    const clusterName = publicConfigClusters.find((cluster) => cluster.id === clusterId)?.name;
    return getI18nConfigCurrentText(clusterName, languageId) || clusterId;
  }, [languageId, publicConfigClusters, selectedTemplateWithDetails?.cluster]);

  const handleDelete = async () => {
    if (!selectedTemplate) {
      return;
    }
    const cluster = resolveTemplateCluster(selectedTemplate.cluster);

    if (!cluster) {
      message.error(t(p("deleteClusterMissing")));
      return;
    }

    setDeleteLoading(true);

    await api
      .deleteJobTemplate({
        query: {
          cluster,
          templateId: selectedTemplate.id,
        },
      })
      .httpError(404, () => {
        message.error(t(p("templateNotFoundOrDeleted")));
      })
      .then(() => {
        message.success(t(p("deleteSuccess")));
        reload();
        setDeleteConfirmOpen(false);
      })
      .finally(() => {
        setDeleteLoading(false);
      });
  };

  const handleUse = async () => {
    if (!selectedTemplate) {
      return;
    }
    const cluster = resolveTemplateCluster(selectedTemplate.cluster);
    if (!cluster) {
      message.error(t(p("useClusterMissing")));
      return;
    }
    if (!selectedTemplateDetail) {
      message.warning(isTemplateDetailLoading ? t(p("detailLoadingRetry")) : t(p("detailFetchFailed")));
      return;
    }
    try {
      await onUse?.({ cluster, template: selectedTemplateDetail });
    } catch {
      message.error(t(p("useFailed")));
    }
  };

  const openRenameModal = (templateKey: string) => {
    const template = templates.find((item) => item.templateKey === templateKey);
    if (!template) {
      return;
    }
    setRenamingTemplateKey(templateKey);
    setRenameValue(template.name);
    setRenameModalOpen(true);
  };

  const handleRenameConfirm = async () => {
    const nextName = renameValue.trim();
    if (!renamingTemplateKey || !nextName) {
      return;
    }

    const renamingTemplate = templates.find((item) => item.templateKey === renamingTemplateKey);
    if (!renamingTemplate) {
      message.error(t(p("templateNotFoundOrDeleted")));
      return;
    }
    const cluster = resolveTemplateCluster(renamingTemplate?.cluster);

    if (!cluster) {
      message.error(t(p("renameClusterMissing")));
      return;
    }

    setRenameLoading(true);
    await api
      .renameJobTemplate({
        body: {
          cluster,
          templateId: renamingTemplate.id,
          jobName: nextName,
        },
      })
      .httpError(404, () => {
        message.error(t(p("templateNotFoundOrDeleted")));
      })
      .httpError(429, () => {
        message.error(t(p("renameNoSpace")));
      })
      .then(() => {
        message.success(t(p("renameSuccess")));
        reload();
        setRenameModalOpen(false);
        setRenamingTemplateKey(undefined);
      })
      .finally(() => {
        setRenameLoading(false);
      });
  };

  const handleRenameCancel = () => {
    setRenameModalOpen(false);
    setRenamingTemplateKey(undefined);
  };

  const openDeleteConfirmModal = () => {
    if (!selectedTemplate) {
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleDeleteCancel = () => {
    if (deleteLoading) {
      return;
    }
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <StyledModal
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
            <TemplateListContainer $maxHeight={leftListMaxHeight}>
              {templates.map((template) => {
                const selected = selectedTemplateKey === template.templateKey;
                const hovered = hoveredTemplateKey === template.templateKey;

                return (
                  <TemplateListItem
                    key={template.templateKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplateKey(template.templateKey)}
                    onMouseEnter={() => setHoveredTemplateKey(template.templateKey)}
                    onMouseLeave={() => setHoveredTemplateKey(undefined)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTemplateKey(template.templateKey);
                      }
                    }}
                    $selected={selected}
                    $hovered={hovered}
                    $selectedColor={token.colorPrimary}
                  >
                    <Tooltip title={template.name} arrow={false}>
                      <TemplateNameText>{template.name}</TemplateNameText>
                    </Tooltip>
                    <span
                      role="button"
                      tabIndex={selected || hovered ? 0 : -1}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRenameModal(template.templateKey);
                      }}
                      style={{
                        display: "inline-flex",
                        cursor: selected || hovered ? "pointer" : "default",
                        opacity: selected || hovered ? 1 : 0,
                        pointerEvents: selected || hovered ? "auto" : "none",
                      }}
                    >
                      <EditIcon styles={{ fontSize: 12, marginLeft: 12 }} />
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
                  items={[
                    { key: "account", label: t(p("account")), children: selectedTemplateWithDetails?.account },
                    {
                      key: "cluster",
                      label: t(p("cluster")),
                      children: clusterDisplayName,
                    },
                    { key: "partition", label: t(p("partition")), children: selectedTemplateWithDetails?.partition },
                    { key: "qos", label: t(p("qos")), children: selectedTemplateWithDetails?.qos },
                    { key: "nodeCount", label: t(p("nodeCount")), children: selectedTemplateWithDetails?.nodeCount },
                    {
                      key: "cpuCoresPerNode",
                      label: t(p("cpuCoresPerNode")),
                      children: selectedTemplateWithDetails?.cpuCoresPerNode,
                    },
                    { key: "maxRuntime", label: t(p("maxRuntime")), children: selectedTemplateWithDetails?.maxRuntime },
                    {
                      key: "command",
                      label: t(p("command")),
                      children: <TemplateCommand>{selectedTemplateWithDetails?.command}</TemplateCommand>,
                    },
                  ]}
                />
              ) : (
                <TemplateEmptyState>
                  <Empty description={isLoading ? t(p("loading")) : t(p("empty"))} />
                </TemplateEmptyState>
              )}
            </TemplateDetailPanel>
            <ModalFooterArea>
              <Button style={{ fontSize: 14 }} onClick={openDeleteConfirmModal} disabled={!selectedTemplate}>
                {t(p("deleteTemplate"))}
              </Button>
              <Button style={{ fontSize: 14 }} type="primary" onClick={handleUse} disabled={!selectedTemplate}>
                {t(p("useTemplate"))}
              </Button>
            </ModalFooterArea>
          </TemplateRightColumn>
        </ModalContentWrapper>
      </StyledModal>
      <StyledModal
        open={renameModalOpen}
        title={t(p("renameTitle"))}
        onCancel={handleRenameCancel}
        onOk={handleRenameConfirm}
        okText={t(p("confirm"))}
        cancelText={t(p("cancel"))}
        confirmLoading={renameLoading}
        okButtonProps={{ disabled: !renameValue.trim() }}
        centered
        styles={{ body: { paddingBottom: 42 } }}
        closable={false}
      >
        <Form requiredMark={false} colon={false}>
          <CompactInlineFormItem label={<FormLabel>{t(p("newTemplateName"))}</FormLabel>} style={{ marginBottom: 0 }}>
            <RoundedInput
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={t(p("templateNameRequired"))}
              autoFocus
              onPressEnter={handleRenameConfirm}
            />
          </CompactInlineFormItem>
        </Form>
      </StyledModal>
      <StyledModal
        open={deleteConfirmOpen}
        title={t(p("deleteTitle"))}
        onCancel={handleDeleteCancel}
        onOk={handleDelete}
        okText={t(p("confirm"))}
        cancelText={t(p("cancel"))}
        confirmLoading={deleteLoading}
        okButtonProps={{ disabled: !selectedTemplate }}
        width={480}
        centered
        styles={{ body: { paddingBottom: 42 } }}
        closable={false}
      >
        <DeleteConfirmText $color={descriptionLabelColor}>{t(p("deleteConfirm"))}</DeleteConfirmText>
      </StyledModal>
    </>
  );
};
