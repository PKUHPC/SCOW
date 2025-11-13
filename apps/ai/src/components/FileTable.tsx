"use client";

import { CloseOutlined } from "@ant-design/icons";
import {
  ArchiveIcon, FolderIcon, ImageIcon, SupportedFileIcon, SymlinkIcon, UnrecognizedFileIcon,
} from "@scow/lib-web/build/icons/FileIcon";
import { isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { Table, TableProps, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import React from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo } from "src/models/File";
import { FileType } from "src/server/trpc/model/file";
import { compareDateTime, formatDateTime } from "src/utils/datetime";
import { isDecompressibleFile } from "src/utils/file";
import { formatSize } from "src/utils/format";
import { compareNumber } from "src/utils/math";

type ColumnKey = ("type" | "name" | "mtime" | "size" | "mode" | "action");

interface Props extends TableProps<FileInfo> {
  files: FileInfo[];
  filesFilter?: (files: FileInfo[]) => FileInfo[];
  fileNameRender?: (fileName: string, r: FileInfo) => React.ReactNode;
  actionRender?: (_: any, r: FileInfo) => React.ReactNode;
  hiddenColumns?: ColumnKey[];
}

export const baseTypeIcons = {
  "DIR": FolderIcon,
  "SYMLINK": SymlinkIcon,
  "ERROR": CloseOutlined,
} as Record<Exclude<FileType, "FILE">, React.ComponentType>;

const iconFor = (file: FileInfo, nonEditableFilenamePostfixes?: string[]): React.ComponentType => {
  if (file.type === "FILE") {
    const name = file.name || "";
    if (isDecompressibleFile(name)) { return ArchiveIcon; }
    if (isImage(name)) { return ImageIcon; }
    const editable = !isNonEditableFilename(name, nonEditableFilenamePostfixes);
    if (editable) { return SupportedFileIcon; }
    return UnrecognizedFileIcon;
  }
  return baseTypeIcons[file.type] || CloseOutlined;
};

export const FileTable: React.FC<Props> = (
  {
    files,
    fileNameRender,
    actionRender,
    filesFilter,
    hiddenColumns,
    ...otherProps
  },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.fileTable.");
  const { publicConfig } = usePublicConfig();

  const columns: ColumnsType<FileInfo> = [
    {
      key: "type",
      dataIndex: "type",
      title: "",
      width: "32px",
      render: (_, r) => React.createElement(iconFor(r, publicConfig.NON_EDITABLE_FILENAME_POSTFIXES)),
    },
    {
      key: "name",
      dataIndex: "name",
      title: t(p("name")),
      defaultSortOrder: "ascend",
      sorter: (a, b) => a.type.localeCompare(b.type) === 0
        ? a.name.localeCompare(b.name)
        : a.type.localeCompare(b.type),
      sortDirections: ["ascend", "descend"],
      render: fileNameRender,
    },
    {
      key: "mtime",
      dataIndex: "mtime",
      title: t(p("mtime")),
      render: (mtime: string | undefined) => mtime ? formatDateTime(mtime) : "",
      sorter: (a, b) => a.type.localeCompare(b.type) === 0
        ? compareDateTime(a.mtime, b.mtime) === 0
          ? a.name.localeCompare(b.name)
          : compareDateTime(a.mtime, b.mtime)
        : a.type.localeCompare(b.type),
    },
    {
      key: "size",
      dataIndex: "size",
      title: t(p("size")),
      render: (size: number | undefined, file: FileInfo) => (size === undefined || file.type === "DIR")
        ? ""
        : (
          <Tooltip title={Math.round((size) / 1024).toLocaleString() + "KB"} placement="topRight">
            <span>{formatSize(Math.round(size / 1024))}</span>
          </Tooltip>
        ),
      sorter: (a, b) => {
        return a.type.localeCompare(b.type) === 0
          ? compareNumber(a.size, b.size) === 0
            ? a.name.localeCompare(b.name)
            : compareNumber(a.size, b.size)
          : a.type.localeCompare(b.type);
      },
    },
    ...(actionRender ? [{
      key: "action",
      dataIndex: "action",
      title: t(p("action")),
      render: actionRender,
    }] : []),
  ];

  return (
    <Table
      {...otherProps}
      dataSource={filesFilter ? filesFilter(files) : files}
      columns={
        hiddenColumns
          ? columns.filter((column) => column.key ? !hiddenColumns.includes(column.key as ColumnKey) : true)
          : columns
      }
      size="small"
    />
  );
};
