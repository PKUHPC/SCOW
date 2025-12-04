import { ReaderExtensions } from "@ddadaal/tsgrpc-common";
import { ObjectWritable } from "@grpc/grpc-js/build/src/object-stream";
import { Logger } from "ts-log";

export interface CopyRequest {
  userId: string;
  fromPath: string;
  toPath: string;
}

export interface CopyReply {}

export interface MoveRequest {
  userId: string;
  fromPath: string;
  toPath: string;
}

export interface MoveReply {}

export interface ExistsRequest {
  userId: string;
  path: string;
}

export interface ExistsReply {
  exists: boolean;
}


export interface CreateFileRequest {
  userId: string;
  path: string;
}

export interface CreateFileReply {}

export interface DeleteDirectoryRequest {
  userId: string;
  path: string;
}

export interface DeleteDirectoryReply {}

export interface DeleteFileRequest {
  userId: string;
  path: string;
}

export interface DeleteFileReply {}

export interface ReadDirectoryRequest {
  userId: string;
  path: string;
  updateAccessTime?: boolean
}

export interface FileInfo {
  name: string;
  type: FileType;
  mtime: string;
  mode: number;
  size: number;
  linkTargetPath?: string;
  linkTargetType?: FileType;
}

export enum FileType {
  FILE = 0,
  DIR = 1,
  SYMLINK = 2,
}

export interface ReadDirectoryReply {
  results: FileInfo[];
}


export interface GetHomeDirectoryRequest {
  userId: string;
}

export interface GetHomeDirectoryReply {
  path: string;
}

export interface MakeDirectoryRequest {
  userId: string;
  path: string;
}

export interface MakeDirectoryReply {}

export interface DownloadRequest {
  userId: string;
  path: string;
  call: ObjectWritable<{ chunk: Uint8Array }>
}

export interface DownloadReply {}

interface UploadRequest_Info {
  userId: string;
  path: string;
}

interface UploadRequest_ReadStream {
  message?: { $case: "info"; info: UploadRequest_Info } | { $case: "chunk"; chunk: Uint8Array } | undefined
}

export interface UploadRequest {
  userId: string;
  path: string;
  call: ReaderExtensions<UploadRequest_ReadStream>
}

export interface UploadReply {
  writtenBytes: number;
}

export interface GetFileMetadataRequest {
  userId: string;
  path: string;
}

export interface GetFileMetadataReply {
  size: number;
  type: FileType;
  isSymlink: boolean;
  linkTargetPath?: string;
  linkTargetType?: FileType;
}

export interface DecompressFileRequest {
  userId: string;
  filePath: string;
  decompressionPath: string;
}

export interface DecompressFileReply {}

export interface StartFileTransferRequest {
  fromCluster: string;
  toCluster: string;
  userId: string;
  fromPath: string;
  toPath: string;
}

export interface StartFileTransferReply {
}

export interface QueryFileTransferRequest {
  cluster: string;
  userId: string;
}

export interface TransferInfo {
  toCluster: string;
  filePath: string;
  transferSizeKb: number;
  progress: number;
  speedKBps: number;
  remainingTimeSeconds: number;
}

export interface QueryFileTransferReply {
  transferInfos: TransferInfo[]
}

export interface TerminateFileTransferRequest {
  fromCluster: string;
  toCluster: string;
  userId: string;
  fromPath: string;
}

export interface TerminateFileTransferReply {

}

// export interface CheckTransferKeyRequest {
//   fromCluster: string;
//   toCluster: string;
//   userId: string;
// }

// export interface CheckTransferKeyReply {
// }

export interface StartFileTransferRequest {
  fromCluster: string;
  toCluster: string;
  userId: string;
  fromPath: string;
  toPath: string;
}

export interface StartFileTransferReply {
}

export interface QueryFileTransferRequest {
  cluster: string;
  userId: string;
}

export interface TransferInfo {
  toCluster: string;
  filePath: string;
  transferSizeKb: number;
  progress: number;
  speedKBps: number;
  remainingTimeSeconds: number;
}

export interface QueryFileTransferReply {
  transferInfos: TransferInfo[]
}

export interface TerminateFileTransferRequest {
  fromCluster: string;
  toCluster: string;
  userId: string;
  fromPath: string;
}

export interface TerminateFileTransferReply {

}

// export interface CheckTransferKeyRequest {
//   fromCluster: string;
//   toCluster: string;
//   userId: string;
// }

// export interface CheckTransferKeyReply {
// }

export interface FileOps {
  copy(req: CopyRequest, logger: Logger): Promise<CopyReply>;
  move(req: MoveRequest, logger: Logger): Promise<MoveReply>;
  exists(req: ExistsRequest, logger: Logger): Promise<ExistsReply>;

  createFile(req: CreateFileRequest, logger: Logger): Promise<CreateFileReply>;
  deleteFile(req: DeleteFileRequest, logger: Logger): Promise<DeleteFileReply>;

  readDirectory(req: ReadDirectoryRequest, logger: Logger): Promise<ReadDirectoryReply>;
  deleteDirectory(req: DeleteDirectoryRequest, logger: Logger): Promise<DeleteDirectoryReply>;
  getHomeDirectory(req: GetHomeDirectoryRequest, logger: Logger): Promise<GetHomeDirectoryReply>;
  makeDirectory(req: MakeDirectoryRequest, logger: Logger): Promise<MakeDirectoryReply>;

  upload(req: UploadRequest, logger: Logger): Promise<UploadReply>;
  download(req: DownloadRequest, logger: Logger): Promise<DownloadReply>;

  getFileMetadata(req: GetFileMetadataRequest, logger: Logger): Promise<GetFileMetadataReply>;

  decompressFile(req: DecompressFileRequest, logger: Logger): Promise<DecompressFileReply>;

  startFileTransfer(req: StartFileTransferRequest, logger: Logger): Promise<StartFileTransferReply>;
  queryFileTransfer(req: QueryFileTransferRequest, logger: Logger): Promise<QueryFileTransferReply>;
  terminateFileTransfer(req: TerminateFileTransferRequest, logger: Logger): Promise<TerminateFileTransferReply>;
  // checkTransferKey(req: CheckTransferKeyRequest, logger: Logger): Promise<CheckTransferKeyReply>;
}
