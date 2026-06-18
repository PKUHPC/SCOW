import { CloseOutlined } from "@ant-design/icons";
import {
  ArchiveIcon,
  FolderIcon,
  ImageIcon,
  SupportedFileIcon,
  SymlinkIcon,
  UnrecognizedFileIcon,
} from "@scow/lib-web/build/icons/FileIcon";
import { isExecutableScriptFilename, isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { join } from "path";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { FileInfo, FileType } from "src/pages/api/file/list";
import { isDecompressibleFile } from "src/server/file";
import { styled } from "styled-components";

import { publicConfig } from "./config";

export type FileInfoKey = React.Key;

export const fileInfoKey = (f: FileInfo, path: string): FileInfoKey => join(path, f.name);

export const TopBar = styled(FilterFormContainer)`
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;
  & > button {
    margin: 0px 4px;
  }
`;

export const baseTypeIcons = {
  DIR: FolderIcon,
  SYMLINK: SymlinkIcon,
  ERROR: CloseOutlined,
} as Record<Exclude<FileType, "FILE">, React.ComponentType>;

export const iconFor = (file: FileInfo): React.ComponentType => {
  if (file.type === "FILE") {
    const name = file.name || "";
    if (isDecompressibleFile(name)) {
      return ArchiveIcon;
    }
    if (isImage(name)) {
      return ImageIcon;
    }
    const editable = !isNonEditableFilename(name, publicConfig.NON_EDITABLE_FILENAME_POSTFIXES);
    const excutable = isExecutableScriptFilename(name, publicConfig.EXECUTABLE_FILENAME_POSTFIXES);
    if (editable || excutable) {
      return SupportedFileIcon;
    }
    return UnrecognizedFileIcon;
  }
  return baseTypeIcons[file.type] || CloseOutlined;
};

export const nodeModeToString = (mode: number) => {
  const numberPermission = (mode & parseInt("777", 8)).toString(8);

  const toStr = (char: string) => {
    const num = +char;
    return ((num & 4) !== 0 ? "r" : "-") + ((num & 2) !== 0 ? "w" : "-") + ((num & 1) !== 0 ? "x" : "-");
  };

  return [0, 1, 2].reduce((prev, curr) => prev + toStr(numberPermission[curr]), "");
};

export const openPreviewLink = (href: string) => {
  window.open(href, "ViewFile", "location=yes,resizable=yes,scrollbars=yes,status=yes");
};
