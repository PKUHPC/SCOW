"use client";

import { FileOutlined, FolderOutlined } from "@ant-design/icons";
import { Table, TableProps, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import React from "react";
import { TableFileInfo } from "src/app/(auth)/files/[cluster]/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileType } from "src/server/trpc/model/file";
import { compareDateTime, formatDateTime } from "src/utils/datetime";
import { formatSize } from "src/utils/format";
import { compareNumber } from "src/utils/math";

type ColumnKey = ("type" | "name" | "mtime" | "size" | "mode" | "action");

interface Props extends TableProps<TableFileInfo> {
  files: TableFileInfo[];
  filesFilter?: (files: TableFileInfo[]) => TableFileInfo[];
  fileNameRender?: (fileName: string, r: TableFileInfo) => React.ReactNode;
  actionRender?: (_: any, r: TableFileInfo) => React.ReactNode;
  hiddenColumns?: ColumnKey[];
}

const fileTypeIcons = {
  "FILE": FileOutlined,
  "DIR": FolderOutlined,
} as Record<FileType, React.ComponentType>;

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

  const columns: ColumnsType<TableFileInfo> = [
    {
      key: "type",
      dataIndex: "type",
      title: "",
      width: "32px",
      render: (_, r) => React.createElement(fileTypeIcons[r.type]),
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
      render: (size: number | undefined, file: TableFileInfo) => (size === undefined || file.type === "DIR")
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
