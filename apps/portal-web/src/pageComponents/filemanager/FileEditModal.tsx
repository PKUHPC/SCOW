import { CloseOutlined, FullscreenExitOutlined, FullscreenOutlined } from "@ant-design/icons";
import Editor, { loader } from "@monaco-editor/react";
import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { getLanguage } from "@scow/lib-web/build/utils/staticFiles";
import { Alert, App, Badge, Button, Modal, Space, Spin, Tabs, Tooltip } from "antd";
import { editor } from "monaco-editor";
import { join } from "path";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { StorageInfo } from "src/pages/api/storage/getUserStorageUsage";
import { publicConfig } from "src/utils/config";
import { convertToBytes } from "src/utils/format";
import { styled } from "styled-components";

import { urlToDownload, urlToUpload } from "./api";

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin: 0 !important;
  }
`;

enum Mode {
  EDIT = "EDIT",
  PREVIEW = "PREVIEW",
}

enum ExitType {
  EXIT_EDIT,
  CLOSE,
}

const FullScreenModalStyle = styled.div`
  .ant-modal {
    transition:
      width 0.3s ease,
      height 0.3s ease;
  }

  &.fullscreen {
    .ant-modal {
      width: 98vw !important;
      height: 100vh !important;
      top: 0 !important;
      padding: 0 !important;
      margin: auto !important;
      max-width: 100vw !important;
    }

    .ant-modal-content {
      height: 100%;
    }

    .ant-modal-body {
      height: calc(100% - 100px);
      overflow-y: auto;
    }
  }
`;

interface PreviewFileProps {
  open: boolean;
  filename: string;
  fileSize: number;
  filePath: string;
  clusterId: string;
}
interface Props {
  previewFile: PreviewFileProps;
  setPreviewFile: Dispatch<SetStateAction<PreviewFileProps>>;
  storageInfo?: StorageInfo;
  canSubmitFile?: boolean;
  onSubmitFile?: () => void;
}

interface ConfirmModalProps {
  open: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
}

interface FilenameProps {
  isEdit: boolean;
  filename: string;
}

export const DEFAULT_FILE_EDIT_LIMIT_SIZE = "1m";

const p = prefix("pageComp.fileManagerComp.fileEditModal.");
const pFileManager = prefix("pageComp.fileManagerComp.fileManager.");

loader.config({
  paths: {
    vs: join(publicConfig.BASE_PATH ?? "", "/monaco-assets/vs"),
  },
  "vs/nls": {
    availableLanguages: {
      "*": "zh-cn", // 默认中文，支持 en 切换
    },
  },
});

function ConfirmModal({ open, saving, onSave, onClose }: ConfirmModalProps) {
  const t = useI18nTranslateToString();

  const handleSave = async () => {
    await onSave();
    onClose();
  };

  return (
    <Modal
      title={t(p("prompt"))}
      open={open}
      okText={t(p("save"))}
      closeIcon={null}
      cancelText={t(p("doNotSave"))}
      cancelButtonProps={{ disabled: saving }}
      onOk={handleSave}
      confirmLoading={saving}
      onCancel={onClose}
      maskClosable={false}
    >
      {t(p("notSavePrompt"))}
    </Modal>
  );
}

const FilenameComponent: React.FC<FilenameProps> = ({ isEdit, filename }) => {
  const t = useI18nTranslateToString();

  return (
    <Tooltip title={isEdit ? t(p("notSaved")) : null}>
      <div>
        <Space size="small">
          <div>{filename}</div>
          {isEdit && <Badge status="processing" />}
        </Space>
      </div>
    </Tooltip>
  );
};

export const FileEditModal: React.FC<Props> = ({
  previewFile,
  setPreviewFile,
  storageInfo,
  canSubmitFile,
  onSubmitFile,
}) => {
  const t = useI18nTranslateToString();

  const { open, filename, fileSize, filePath, clusterId } = previewFile;

  const [mode, setMode] = useState<Mode>(Mode.PREVIEW);
  const [fileContent, setFileContent] = useState<string | undefined>(undefined);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [exitType, setExitType] = useState<ExitType>(ExitType.CLOSE);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [abortController, setAbortController] = useState(new AbortController());
  const { dark } = useDarkMode();
  const languageId = useI18n().currentLanguage.id;

  const [options, setOptions] = useState({
    readOnly: true,
    lineNumbersMinChars: 7,
  });

  useEffect(() => {
    loader.config({
      "vs/nls": {
        availableLanguages: {
          // null 表示采用默认语言，默认语言为英语
          "*": languageId === SYSTEM_VALID_LANGUAGES.ZH_CN ? "zh-cn" : null,
        },
      },
    });
  }, [languageId]);

  useEffect(() => {
    if (open) {
      downloadFile();
    }
  }, [open]);

  useEffect(() => {
    if (editorRef.current) {
      const editorInstance = editorRef.current.getModel();

      // 设置换行符为 LF (\n)
      editorInstance?.setEOL(0); // 0 代表 LF，1 代表 CRLF
    }
  }, [editorRef.current]);

  const { message } = App.useApp();

  const handleEdit = (content) => {
    if (mode === Mode.EDIT) {
      setIsEdit(true);
    }
    setFileContent(content);
  };

  const closeProcess = () => {
    setConfirm(false);
    setIsEdit(false);
    setMode(Mode.PREVIEW);
    setFileContent(undefined);
    setOptions({
      ...options,
      readOnly: true,
    });
    setPreviewFile({
      ...previewFile,
      open: false,
    });
    setIsFullScreen(false);
  };

  const handleClose = () => {
    if (downloading) {
      abortController.abort();
    }
    if (!isEdit) {
      closeProcess();
      return;
    }

    setExitType(ExitType.CLOSE);
    setConfirm(true);
  };

  const exitEditModeProcess = () => {
    downloadFile();
    setConfirm(false);
    setIsEdit(false);
    setMode(Mode.PREVIEW);
    setOptions({
      ...options,
      readOnly: true,
    });
  };

  const handleExitEditMode = () => {
    if (!isEdit) {
      exitEditModeProcess();
      return;
    }

    setExitType(ExitType.EXIT_EDIT);
    setConfirm(true);
  };

  const handleSave = async () => {
    if (fileContent === undefined) {
      return;
    }

    setSaving(true);
    const blob = new Blob([fileContent], { type: "text/plain" });

    const formData = new FormData();
    formData.append("file", blob);

    await fetch(urlToUpload(clusterId, filePath), {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          return Promise.reject(response.statusText);
        }
        message.success(t(p("saveFileSuccess")));
        setIsEdit(false);
      })
      .catch(() => {
        message.error(t(p("saveFileFail")));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const downloadFile = () => {
    if (!open) {
      return;
    }

    setLoading(true);
    setDownloading(true);

    const newAbortController = new AbortController();
    setAbortController(newAbortController);
    fetch(urlToDownload(clusterId, filePath, false), { signal: newAbortController.signal })
      .then((res) => {
        if (!res.ok) {
          message.error(t(p("failedGetFile"), [filename]));
          return;
        }
        return res.body?.getReader();
      })
      .then(async (reader) => {
        if (reader) {
          let accumulatedChunks = "";
          let accumulatedSize = 0;
          const CHUNK_SIZE = 3 * 1024 * 1024;
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              setFileContent(() => {
                return accumulatedChunks;
              });
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            accumulatedChunks += chunk;
            accumulatedSize += chunk.length;

            if (accumulatedSize > CHUNK_SIZE) {
              setFileContent(() => {
                return accumulatedChunks;
              });
              accumulatedSize = 0;
              setLoading(false);
            }
          }
        } else {
          message.error(t(p("cantReadFile"), [filename]));
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          message.info(t(p("fileFetchAbortPrompt"), [filename]));
        } else {
          message.error(t(p("cantReadFile"), [filename]));
        }
      })
      .finally(() => {
        setLoading(false);
        setDownloading(false);
      });
  };

  const modalTitle = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{mode === "PREVIEW" ? t(p("filePreview")) : t(p("fileEdit"))}</span>
      <div style={{ position: "relative", top: "-2px" }}>
        <Button
          style={{ marginBottom: 2, color: "#8c8c8c" }}
          type="text"
          onClick={() => setIsFullScreen(!isFullScreen)}
          icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        />
        <Button style={{ color: "#8c8c8c" }} type="text" onClick={handleClose} icon={<CloseOutlined />} />
      </div>
    </div>
  );

  const modalFooterRender = () => {
    const fileEditLimitSize = publicConfig.FILE_EDIT_SIZE || DEFAULT_FILE_EDIT_LIMIT_SIZE;
    const editButton =
      fileSize <= convertToBytes(fileEditLimitSize) && !downloading ? (
        <Button
          type="primary"
          onClick={() => {
            setMode(Mode.EDIT);
            setOptions({
              ...options,
              readOnly: false,
            });
          }}
        >
          {t(p("edit"))}
        </Button>
      ) : (
        <Tooltip title={downloading ? t(p("fileLoading")) : t(p("fileSizeExceeded"), [fileEditLimitSize])}>
          <Button disabled={true}>{t(p("edit"))}</Button>
        </Tooltip>
      );

    return mode === Mode.PREVIEW ? (
      <Space>
        {canSubmitFile && (
          <Button onClick={onSubmitFile} disabled={downloading || !onSubmitFile} type="primary">
            {t(pFileManager("submitJob"))}
          </Button>
        )}
        {editButton}
      </Space>
    ) : (
      <>
        {storageInfo && storageInfo.quotaBytes - storageInfo.usedStorageBytes <= convertToBytes("10M") && (
          <Alert
            style={{ textAlign: "left", marginBottom: "10px" }}
            message={t(p("quotaLimit"))}
            type="warning"
            showIcon
          />
        )}
        <Space>
          <Button type="primary" disabled={!isEdit} loading={saving} onClick={handleSave}>
            {t(p("save"))}
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              handleExitEditMode();
            }}
          >
            {t(p("exitEdit"))}
          </Button>
        </Space>
      </>
    );
  };

  return (
    <FullScreenModalStyle className={isFullScreen ? "fullscreen" : ""}>
      <Modal
        open={open}
        onCancel={handleClose}
        title={modalTitle}
        footer={modalFooterRender()}
        getContainer={false}
        width={1000}
        maskClosable={false}
        closeIcon={null}
      >
        <StyledTabs
          type="card"
          items={[
            {
              label: <FilenameComponent isEdit={isEdit} filename={filename} />,
              key: `${filename}`,
              children: (
                <Spin spinning={loading}>
                  <Editor
                    height={isFullScreen ? "78vh" : "60vh"}
                    defaultLanguage={getLanguage(filename)}
                    theme={dark ? "vs-dark" : "light"}
                    options={options}
                    value={fileContent}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    onChange={(content) => {
                      if (!downloading) {
                        handleEdit(content);
                      }
                    }}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Modal>
      <ConfirmModal
        open={confirm}
        saving={saving}
        onSave={handleSave}
        onClose={() => (exitType === ExitType.CLOSE ? closeProcess() : exitEditModeProcess())}
      />
    </FullScreenModalStyle>
  );
};
