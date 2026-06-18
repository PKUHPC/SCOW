import type { AppTemplateDetail } from "src/pages/api/app/listAppTemplates";

import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { CompactInlineFormItem, StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Descriptions, Empty, Form, theme as antdTheme } from "antd";
import React, { useCallback, useMemo, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { EditIcon } from "src/icons/headerIcons/headerIcons";
import {
  DeleteConfirmText,
  ModalContentWrapper,
  ModalFooterArea,
  TemplateDetailPanel,
  TemplateEmptyState,
  TemplateListContainer,
  TemplateListItem,
  TemplateListPanel,
  TemplateNameText,
  TemplateRightColumn,
} from "src/pageComponents/style/templateModal.styles";
import {
  formatMaxRuntime,
  useTemplateModal,
  type TemplateModalMessages,
} from "src/pageComponents/style/useTemplateModal";
import { AppCustomAttribute } from "src/pages/api/app/getAppMetadata";
import { ReservedAppAttributeName } from "src/models/job";
import { useTheme } from "styled-components";

import {
  getSavedCustomTemplateFieldNames,
  getSavedResourceTemplateFieldNames,
  templateCustomAttributesKey,
  templateResourceAttributesKey,
} from "./LauchAppFormUtils";

export interface AppTemplateListModalProps {
  open: boolean;
  onClose: () => void;
  onUse?: (template: AppTemplateDetail) => void | Promise<void>;
  appId: string;
  cluster: string;
  attributes?: AppCustomAttribute[];
  refreshSignal?: number;
}

const p = prefix("pageComp.app.appTemplateListModal.");

export const AppTemplateListModal: React.FC<AppTemplateListModalProps> = ({
  open,
  onClose,
  onUse,
  appId,
  cluster,
  attributes = [],
  refreshSignal,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const leftListMaxHeight = 380;

  const { useToken } = antdTheme;
  const { token } = useToken();
  const theme = useTheme();

  const gray = theme.palette.gray;
  const descriptionLabelColor = gray[6];
  const descriptionContentColor = gray[8];

  const { message } = App.useApp();
  const messages = useMemo<TemplateModalMessages>(
    () => ({
      templateNotFoundOrDeleted: t(p("templateNotFoundOrDeleted")),
      deleteSuccess: t(p("deleteSuccess")),
      templateNameExists: t(p("templateNameExists")),
      renameSuccess: t(p("renameSuccess")),
    }),
    [t],
  );

  const fetchFn = useCallback(async () => {
    if (!open || !appId) return [];
    return await api.listAppTemplates({ query: { appId, cluster } }).then((x) => x.results);
  }, [appId, cluster, open, refreshSignal]);

  const deleteApiFn = useCallback(
    (id: number, templateName: string) => api.deleteAppTemplate({ query: { id, templateName } }),
    [],
  );

  const renameApiFn = useCallback(
    (id: number, newName: string, templateName: string) =>
      api.renameAppTemplate({ body: { id, newName, templateName } }),
    [],
  );

  const {
    templates,
    selectedTemplate,
    isLoading,
    selectedTemplateId,
    setSelectedTemplateId,
    hoveredTemplateId,
    setHoveredTemplateId,
    renameModalOpen,
    setRenameModalOpen,
    setRenamingTemplateId,
    renameValue,
    setRenameValue,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleteLoading,
    renameLoading,
    handleDelete,
    openRenameModal,
    handleRenameConfirm,
  } = useTemplateModal(fetchFn, messages, deleteApiFn, renameApiFn);

  const customAttributeEntries = useMemo(() => {
    if (!selectedTemplate?.customAttributes) return [];
    try {
      const parsed = JSON.parse(selectedTemplate.customAttributes) as Record<string, string>;
      const savedCustomFieldNames = getSavedCustomTemplateFieldNames(selectedTemplate.customAttributes);
      const customFieldNames = savedCustomFieldNames
        ? Array.from(savedCustomFieldNames)
        : Object.keys(parsed).filter((key) => key !== templateResourceAttributesKey && key !== templateCustomAttributesKey);

      return customFieldNames.map((key) => [key, parsed[key]] as const);
    } catch {
      return [];
    }
  }, [selectedTemplate?.customAttributes]);

  const savedResourceFieldNames = useMemo(
    () => getSavedResourceTemplateFieldNames(selectedTemplate?.customAttributes),
    [selectedTemplate?.customAttributes],
  );

  const shouldShowResourceField = (attributeName: ReservedAppAttributeName) => {
    return !savedResourceFieldNames || savedResourceFieldNames.has(attributeName);
  };

  const runtimeLabels = { days: t(p("days")), hours: t(p("hours")), minutes: t(p("minutes")) };

  const [useLoading, setUseLoading] = useState(false);

  const handleUse = async () => {
    if (!selectedTemplate) return;
    setUseLoading(true);
    try {
      await onUse?.(selectedTemplate);
    } catch {
      message.error(t(p("useFailed")));
    } finally {
      setUseLoading(false);
    }
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
              {templates.map((tpl) => {
                const selected = selectedTemplateId === tpl.id;
                const hovered = hoveredTemplateId === tpl.id;

                return (
                  <TemplateListItem
                    key={tpl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    onMouseEnter={() => setHoveredTemplateId(tpl.id)}
                    onMouseLeave={() => setHoveredTemplateId(undefined)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTemplateId(tpl.id);
                      }
                    }}
                    $selected={selected}
                    $hovered={hovered}
                    $selectedColor={token.colorPrimary}
                  >
                    <Tooltip title={tpl.templateName} arrow={false}>
                      <TemplateNameText>{tpl.templateName}</TemplateNameText>
                    </Tooltip>
                    <span
                      role="button"
                      tabIndex={selected || hovered ? 0 : -1}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRenameModal(tpl.id);
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
                    ...(shouldShowResourceField(ReservedAppAttributeName.ACCOUNT)
                      ? [{ key: "account", label: t(p("account")), children: selectedTemplate.account || "-" }]
                      : []),
                    { key: "cluster", label: t(p("cluster")), children: selectedTemplate.cluster || "-" },
                    ...(shouldShowResourceField(ReservedAppAttributeName.PARTITION)
                      ? [{ key: "partition", label: t(p("partition")), children: selectedTemplate.partition || "-" }]
                      : []),
                    ...(shouldShowResourceField(ReservedAppAttributeName.QOS)
                      ? [{ key: "qos", label: t(p("qos")), children: selectedTemplate.qos || "-" }]
                      : []),
                    ...(shouldShowResourceField(ReservedAppAttributeName.NODE_COUNT)
                      ? [{ key: "nodeCount", label: t(p("nodeCount")), children: `${selectedTemplate.nodeCount}` }]
                      : []),
                    ...(shouldShowResourceField(ReservedAppAttributeName.CORE_COUNT)
                      ? [{ key: "coreCount", label: t(p("coreCount")), children: `${selectedTemplate.coreCount}` }]
                      : []),
                    ...(selectedTemplate.gpuCount !== 0 && shouldShowResourceField(ReservedAppAttributeName.GPU_COUNT)
                      ? [{ key: "gpuCount", label: t(p("gpuCount")), children: `${selectedTemplate.gpuCount}` }]
                      : []),
                    {
                      key: "maxRuntime",
                      label: t(p("maxRuntime")),
                      children: formatMaxRuntime(selectedTemplate.maxTime, selectedTemplate.maxTimeUnit, runtimeLabels),
                    },
                    ...customAttributeEntries.map(([key, value]) => {
                      const attrDef = attributes.find((a) => a.name === key);
                      const label = attrDef ? getI18nConfigCurrentText(attrDef.label, languageId) : key;
                      return { key: `custom_${key}`, label, children: value === undefined ? "-" : String(value) };
                    }),
                  ]}
                />
              ) : (
                <TemplateEmptyState>
                  <Empty description={isLoading ? t(p("loading")) : t(p("empty"))} />
                </TemplateEmptyState>
              )}
            </TemplateDetailPanel>
            <ModalFooterArea>
              <Button style={{ fontSize: 14 }} onClick={() => setDeleteConfirmOpen(true)} disabled={!selectedTemplate}>
                {t(p("deleteTemplate"))}
              </Button>
              <Button
                style={{ fontSize: 14 }}
                type="primary"
                onClick={handleUse}
                disabled={!selectedTemplate}
                loading={useLoading}
              >
                {t(p("useTemplate"))}
              </Button>
            </ModalFooterArea>
          </TemplateRightColumn>
        </ModalContentWrapper>
      </StyledModal>
      <StyledModal
        open={renameModalOpen}
        title={t(p("renameTitle"))}
        onCancel={() => {
          setRenameModalOpen(false);
          setRenamingTemplateId(undefined);
        }}
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
        onCancel={() => {
          if (!deleteLoading) setDeleteConfirmOpen(false);
        }}
        onOk={handleDelete}
        okText={t(p("confirm"))}
        cancelText={t(p("cancel"))}
        confirmLoading={deleteLoading}
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
