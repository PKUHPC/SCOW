import { EllipsisNameWrapper } from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { ConsistentBorderTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { compareNullableFileMode } from "@scow/lib-web/build/utils/compareNullableValue";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber } from "@scow/lib-web/build/utils/math";
import { TableProps, Tooltip } from "antd";
import { ColumnsType } from "antd/es/table";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo } from "src/pages/api/file/list";
import { iconFor } from "src/utils/file";
import { formatSize } from "src/utils/format";

type ColumnKey = "type" | "name" | "mtime" | "size" | "mode" | "action";

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
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {React.createElement(iconFor(r), {
            style: { width: 18, height: 18, fontSize: 18 },
          })}
        </div>
      ),
    },
    {
      key: "name",
      dataIndex: "name",
      title: t(p("fileName")),
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
      title: t(p("changeTime")),
      width: hiddenColumns ? 240 : "22%",
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
      width: hiddenColumns ? 100 : "12%",
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
    {
      key: "mode",
      dataIndex: "mode",
      title: t(p("mode")),
      width: hiddenColumns ? 150 : "14%",
      render: (mode: number | undefined) => {
        const formattedMode = mode === undefined ? "" : nodeModeToString(mode);
        return <span title={formattedMode}>{formattedMode}</span>;
      },
      // 对权限进行排序
      sorter: (a, b) => compareNullableFileMode(a.mode, b.mode),
    },
    ...(actionRender
      ? [
          {
            key: "action",
            dataIndex: "action",
            title: t(p("action")),
            width: "14%",
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
      scroll={{ ...otherProps.scroll, x: hiddenColumns ? 560 : 960 }}
    />
  );
};
