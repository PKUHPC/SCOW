import { compareNullableFileMode } from "@scow/lib-web/build/utils/compareNullableValue";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber } from "@scow/lib-web/build/utils/math";
import { Table, TableProps, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo } from "src/pages/api/file/list";
import { iconFor } from "src/utils/file";
import { formatSize } from "src/utils/format";

type ColumnKey = ("type" | "name" | "mtime" | "size" | "mode" | "action");

const nodeModeToString = (mode: number) => {
  const numberPermission = (mode & parseInt("777", 8)).toString(8);

  const toStr = (char: string) => {
    const num = +char;
    return ((num & 4) !== 0 ? "r" : "-") + ((num & 2) !== 0 ? "w" : "-") + ((num & 1) !== 0 ? "x" : "-");
  };

  return [0, 1, 2].reduce((prev, curr) => prev + toStr(numberPermission[curr]), "");
};

interface Props extends TableProps<FileInfo> {
  files: FileInfo[];
  filesFilter?: (files: FileInfo[]) => FileInfo[];
  fileNameRender?: (fileName: string, r: FileInfo) => React.ReactNode;
  actionRender?: (_, r: FileInfo) => React.ReactNode;
  hiddenColumns?: ColumnKey[];
}

const p = prefix("pageComp.fileManagerComp.fileTable.");

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

  const columns: ColumnsType<FileInfo> = [
    {
      key: "type",
      dataIndex: "type",
      title: "",
      width: "32px",
      render: (_, r) => React.createElement(iconFor(r)),
    },
    {
      key: "name",
      dataIndex: "name",
      title: t(p("fileName")),
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
      title: t(p("changeTime")),
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
    {
      key: "mode",
      dataIndex: "mode",
      title: t(p("mode")),
      render: (mode: number | undefined) => mode === undefined ? "" : nodeModeToString(mode),
      // 对权限进行排序
      sorter: (a, b) => compareNullableFileMode(a.mode, b.mode),
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
