import { z } from "zod";

// 抽出文件的Schema
// 不直接放在route/file.ts中是因为fileDriver.ts中也需要用到
// 而且 fileDriver.ts中不能引用route/file.ts
// 否则上传接口route.ts会报和ORM相关的错误：不能导入 oracleDb

export const FileType = z.union([z.literal("FILE"), z.literal("DIR")]);
export type FileType = z.infer<typeof FileType>;

export const ListDirectorySchema = z.object({
  type: FileType,
  name: z.string(),
  mtime: z.string(),
  size: z.number(),
  mode: z.number(),
});

export type ListDirectoryOutput = z.infer<typeof ListDirectorySchema>;

export const FileMetaSchema = z.object({
  size: z.number(),
  type: z.string(),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;


export const InitMultipartUploadResponseSchema = z.object({
  tempFileDir: z.string(),
  chunkSizeByte: z.number(),
  filesInfo: z.array(ListDirectorySchema),

});
