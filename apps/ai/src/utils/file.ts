import { TreeDataNode } from "antd";
import { join, resolve, sep } from "path";
import { FileInfo } from "src/models/File";

const decompressibleExtensions = [".zip", ".tar", ".tar.gz", ".tgz", ".gz"];

export function getExtension(filename: string) {
  const parts = filename.split(".");
  const extension = parts.pop();
  return extension ? extension.toLowerCase() : "";
}

export function isDecompressibleFile(filename: string) {
  return decompressibleExtensions.some((extension) => filename.endsWith(extension));
}

/**
 * 判断一个文件夹路径是否是另一个文件夹路径的父级或者本身。
 * @param potentialParentFolderPath 可能的父级文件夹路径。
 * @param childFolderPath 子文件夹路径。
 * @returns true 如果 childFolderPath 是 potentialParentFolderPath 的子路径或本身。
 */
export function isParentOrSameFolder(potentialParentFolderPath: string, childFolderPath: string): boolean {
  const normalizedParentPath = resolve(potentialParentFolderPath);
  const normalizedChildPath = resolve(childFolderPath);

  // 确保父路径以路径分隔符结束
  const parentPathWithTrailingSlash = normalizedParentPath.endsWith(sep)
    ? normalizedParentPath
    : `${normalizedParentPath}${sep}`;

  return normalizedChildPath === normalizedParentPath || normalizedChildPath.startsWith(parentPathWithTrailingSlash);
}

export function getFilePathWithoutExtension(fileName: string) {
  return fileName?.replace(/\.[^/.]+$/, "");
}

export const generateFilesTree = (path: string, files: FileInfo[]): TreeDataNode[] => {
  return [
    {
      title: `${path}`,
      key: "root",
      children: files.map((f) => ({
        title: f.name,
        key: f.name,
      })),
    },
  ];
};

export const fileInfoKey = (f: FileInfo, path: string): React.Key => join(path, f.name);
