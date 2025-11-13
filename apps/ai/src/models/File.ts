export type FileType = "FILE" | "DIR" | "SYMLINK";

export interface FileInfo {
  name: string,
  type: FileType,
  mtime: string,
  mode: number,
  size: number,
  // For symlink entries
  linkTargetPath?: string,
  linkTargetType?: FileType,
}
