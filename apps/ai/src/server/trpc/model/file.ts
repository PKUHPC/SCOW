import { z } from "zod";

// 抽出文件的Schema
// 不直接放在route/file.ts中是因为fileDriver.ts中也需要用到
// 而且 fileDriver.ts中不能引用route/file.ts
// 否则上传接口route.ts会报和ORM相关的错误：不能导入 oracleDb

export const FileType = z.union([z.literal("FILE"), z.literal("DIR"), z.literal("SYMLINK")]);
export type FileType = z.infer<typeof FileType>;

export const ListDirectorySchema = z.object({
  type: FileType,
  name: z.string(),
  mtime: z.string(),
  size: z.number(),
  mode: z.number(),
  linkTargetPath: z.string().optional(),
  linkTargetType: FileType.optional(),
});

export type ListDirectoryOutput = z.infer<typeof ListDirectorySchema>;

export const FileMetaSchema = z.object({
  size: z.number(),
  type: FileType,
  isSymlink: z.boolean(),
  linkTargetPath: z.optional(z.string()),
  linkTargetType: FileType.optional(),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;


export const InitMultipartUploadResponseSchema = z.object({
  chunkSizeByte: z.number(),
  fileSizeByte: z.number(),
  modificationTime: z.number(),
  uploadedIndices: z.array(z.number()),
});
