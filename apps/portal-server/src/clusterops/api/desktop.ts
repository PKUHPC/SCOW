import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { Logger } from "ts-log";

export interface CreateDesktopRequest {
  loginNode: string;
  userId: string;
  wm: string;
  desktopName: string;
  remoteControlTool?: RemoteControlTool;
}

export interface CreateDesktopReply {
  host: string;
  port: number;
  password: string;
  shadowDeskUrl?: string;
}

export interface KillDesktopRequest {
  loginNode: string;
  userId: string;
  displayId: number;
  desktopName?: string;
  desktopType?: string;
  id: number;
}

export interface KillDesktopReply {}

export interface ConnectToDesktopRequest {
  loginNode: string;
  userId: string;
  displayId: number;
  id: number;
}

export interface ConnectToDesktopReply {
  host: string;
  port: number;
  password: string;
}

export interface ListUserDesktopsRequest {
  userId: string;
  loginNode: string;
}

export interface Desktop {
  id?: number;
  displayId: number;
  desktopName: string;
  wm: string;
  isActive?: boolean;
  createTime?: string;
  type?: RemoteControlTool;
}

export interface ListUserDesktopsReply {
  host: string;
  desktops: Desktop[];
}

export interface DesktopOps {
  createDesktop(req: CreateDesktopRequest, logger: Logger): Promise<CreateDesktopReply>;
  killDesktop(req: KillDesktopRequest, logger: Logger): Promise<KillDesktopReply>;
  connectToDesktop(req: ConnectToDesktopRequest, logger: Logger): Promise<ConnectToDesktopReply>;
  listUserDesktops(req: ListUserDesktopsRequest, logger: Logger): Promise<ListUserDesktopsReply>;
}
