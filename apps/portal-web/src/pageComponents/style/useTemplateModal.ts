import { App } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";

export function formatMaxRuntime(
  value: number,
  unit: number,
  labels: { days: string; hours: string; minutes: string },
): string {
  if (unit === 2) return `${value} ${labels.days}`;
  if (unit === 1) return `${value} ${labels.hours}`;
  return `${value} ${labels.minutes}`;
}

export interface TemplateModalMessages {
  templateNotFoundOrDeleted: string;
  deleteSuccess: string;
  templateNameExists: string;
  renameSuccess: string;
}

export function useTemplateModal<T extends { id: number; templateName: string }>(
  fetchFn: () => Promise<T[]>,
  messages: TemplateModalMessages,
  deleteApi: (id: number, templateName: string) => PromiseLike<unknown>,
  renameApi: (id: number, newName: string, templateName: string) => PromiseLike<unknown>,
) {
  const { message } = App.useApp();

  const [templates, setTemplates] = useState<T[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [hoveredTemplateId, setHoveredTemplateId] = useState<number | undefined>();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingTemplateId, setRenamingTemplateId] = useState<number | undefined>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);

  const { data: templateData, isLoading, reload } = useAsync({ promiseFn: fetchFn });

  useEffect(() => {
    const list = templateData ?? [];
    setTemplates(list);
    setSelectedTemplateId((previous) => (list.some((item) => item.id === previous) ? previous : list[0]?.id));
  }, [templateData]);

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedTemplateId),
    [selectedTemplateId, templates],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedTemplate) return;
    setDeleteLoading(true);
    try {
      await deleteApi(selectedTemplate.id, selectedTemplate.templateName);
      message.success(messages.deleteSuccess);
      reload();
      setDeleteConfirmOpen(false);
    } catch {
      message.error(messages.templateNotFoundOrDeleted);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteApi, message, messages, reload, selectedTemplate]);

  const openRenameModal = useCallback((templateId: number) => {
    const tpl = templates.find((item) => item.id === templateId);
    if (!tpl) return;
    setRenamingTemplateId(templateId);
    setRenameValue(tpl.templateName);
    setRenameModalOpen(true);
  }, [templates]);

  const handleRenameConfirm = useCallback(async () => {
    const nextName = renameValue.trim();
    if (renamingTemplateId === undefined || !nextName) return;
    const renamingTemplate = templates.find((item) => item.id === renamingTemplateId);
    if (!renamingTemplate) return;
    setRenameLoading(true);
    try {
      await renameApi(renamingTemplateId, nextName, renamingTemplate.templateName);
      message.success(messages.renameSuccess);
      reload();
      setRenameModalOpen(false);
      setRenamingTemplateId(undefined);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 409) {
        message.error(messages.templateNameExists);
      } else {
        message.error(messages.templateNotFoundOrDeleted);
      }
    } finally {
      setRenameLoading(false);
    }
  }, [renameApi, message, messages, reload, renamingTemplateId, renameValue, templates]);

  return {
    templates,
    selectedTemplate,
    isLoading,
    selectedTemplateId,
    setSelectedTemplateId,
    hoveredTemplateId,
    setHoveredTemplateId,
    renameModalOpen,
    setRenameModalOpen,
    renamingTemplateId,
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
  };
}
