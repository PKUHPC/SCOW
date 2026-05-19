import { AugmentedCall } from "@ddadaal/tsgrpc-server";
import { ServerDuplexStream } from "@grpc/grpc-js";
import { Logger } from "ts-log";

interface Connect {
  userId: string;
  cluster: string;
  loginNode: string;
  cols?: number;
  rows?: number;
  path?: string;
}

interface Resize {
  cols: number;
  rows: number;
}

interface Data {
  data: Uint8Array;
}

interface Disconnect {}

interface ShellRequest {
  cluster: string;
  loginNode: string;
  userId: string;
  path?: string;
  rows?: number;
  cols?: number;
  call: AugmentedCall<ServerDuplexStream<ShellRequest_ReadStream, ShellRequest_WriteStream>>;
}

interface ShellRequest_ReadStream {
  message?:
    | { $case: "connect"; connect: Connect }
    | { $case: "resize"; resize: Resize }
    | { $case: "data"; data: Data }
    | { $case: "disconnect"; disconnect: Disconnect }
    | undefined;
}

interface ShellRequest_WriteStream {
  message: { $case: "exit"; exit: Exit } | { $case: "data"; data: Data };
}

interface Exit {
  code?: number;
  signal?: string;
}

export interface ShellReply {}

export interface ShellOps {
  shell(req: ShellRequest, logger: Logger): Promise<ShellReply>;
}
