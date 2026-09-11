"use client";

import { CloseOutlined } from "@ant-design/icons";
import {
  EllipsisNameWrapper,
  type FileIconComponent,
} from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { ConsistentBorderTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import {
  ArchiveIcon,
  FolderIcon,
  ImageIcon,
  SupportedFileIcon,
  SymlinkIcon,
  UnrecognizedFileIcon,
} from "@scow/lib-web/build/icons/FileIcon";
import { isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { TableProps, Tooltip } from "antd";
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

type ColumnKey = "type" | "name" | "mtime" | "size" | "mode" | "action";

interface Props extends TableProps<FileInfo> {
  files: FileInfo[];
  filesFilter?: (files: FileInfo[]) => FileInfo[];
  fileNameRender?: (fileName: string, r: FileInfo) => React.ReactNode;
  actionRender?: (_: any, r: FileInfo) => React.ReactNode;
  hiddenColumns?: ColumnKey[];
}

export const baseTypeIcons = {
  DIR: FolderIcon,
  SYMLINK: SymlinkIcon,
  ERROR: CloseOutlined,
} as Record<Exclude<FileType, "FILE">, FileIconComponent>;

const iconFor = (file: FileInfo, nonEditableFilenamePostfixes?: string[]): FileIconComponent => {
  if (file.type === "FILE") {
    const name = file.name || "";
    if (isDecompressibleFile(name)) {
      return ArchiveIcon;
    }
    if (isImage(name)) {
      return ImageIcon;
    }
    const editable = !isNonEditableFilename(name, nonEditableFilenamePostfixes);
    if (editable) {
      return SupportedFileIcon;
    }
    return UnrecognizedFileIcon;
  }
  return baseTypeIcons[file.type] || CloseOutlined;
};

export const FileTable: React.FC<Props> = ({
  files,
  fileNameRender,
  actionRender,
  filesFilter,
  hiddenColumns,
  rowSelection,
  ...otherProps
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.fileTable.");
  const { publicConfig } = usePublicConfig();

  const columns: ColumnsType<FileInfo> = [
    {
      key: "type",
      dataIndex: "type",
      title: "",
      className: "file-type-column",
      width: 42,
      align: "center",
      render: (_, r) => (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          {React.createElement(iconFor(r, publicConfig.NON_EDITABLE_FILENAME_POSTFIXES), {
            style: { width: 18, height: 18, fontSize: 18 },
          })}
        </div>
      ),
    },
    {
      key: "name",
      dataIndex: "name",
      title: t(p("name")),
      defaultSortOrder: "ascend",
      sorter: (a, b) =>
        a.type.localeCompare(b.type) === 0 ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type),
      sortDirections: ["ascend", "descend"],
      render: (text: string, record: FileInfo) => {
        const renderedNode = fileNameRender ? fileNameRender(text, record) : text;
        return <EllipsisNameWrapper title={text}>{renderedNode}</EllipsisNameWrapper>;
      },
    },
    {
      key: "mtime",
      dataIndex: "mtime",
      title: t(p("mtime")),
      width: hiddenColumns ? 240 : "26%",
      render: (mtime: string | undefined) => {
        const formattedMtime = mtime ? formatDateTime(mtime) : "";
        return <span title={formattedMtime}>{formattedMtime}</span>;
      },
      sorter: (a, b) =>
        a.type.localeCompare(b.type) === 0
          ? compareDateTime(a.mtime, b.mtime) === 0
            ? a.name.localeCompare(b.name)
            : compareDateTime(a.mtime, b.mtime)
          : a.type.localeCompare(b.type),
    },
    {
      key: "size",
      dataIndex: "size",
      title: t(p("size")),
      width: hiddenColumns ? 100 : "16%",
      render: (size: number | undefined, file: FileInfo) =>
        size === undefined || file.type === "DIR" ? (
          ""
        ) : (
          <Tooltip title={Math.round(size / 1024).toLocaleString() + "KB"} placement="topRight">
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
    ...(actionRender
      ? [
          {
            key: "action",
            dataIndex: "action",
            title: t(p("action")),
            width: "16%",
            render: actionRender,
          },
        ]
      : []),
  ];

  return (
    <ConsistentBorderTable
      {...otherProps}
      rowSelection={rowSelection ? { ...rowSelection, columnWidth: 56 } : rowSelection}
      dataSource={filesFilter ? filesFilter(files) : files}
      columns={
        hiddenColumns
          ? columns.filter((column) => (column.key ? !hiddenColumns.includes(column.key as ColumnKey) : true))
          : columns
      }
      size="small"
      tableLayout="fixed"
      scroll={{ ...otherProps.scroll, x: hiddenColumns ? 560 : 840 }}
    />
  );
};
