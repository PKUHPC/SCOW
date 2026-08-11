import { ValueOf } from "next/dist/shared/lib/constants";

export enum AppAuthTargetType {
  TENANT = "TENANT",
  ACCOUNT = "ACCOUNT",
}

export const AppAuthTargetTypeProto = {
  UNKNOWN: 0,
  TENANT: 1,
  ACCOUNT: 2,
} as const;
export type AppAuthTargetTypeProto = ValueOf<typeof AppAuthTargetTypeProto>;

export enum AppScope {
  HPC = "HPC",
  AI = "AI",
}

export const AuthorizeAction = {
  AUTHORIZE: 0,
  UNAUTHORIZE: 1,
} as const;
export type AuthorizeAction = ValueOf<typeof AuthorizeAction>;

export const UpdateDefaultAppAction = {
  ADD_TO_DEFAULT_APPS: 0,
  REMOVE_FROM_DEFAULT_APPS: 1,
} as const;
export type UpdateDefaultAppAction = ValueOf<typeof UpdateDefaultAppAction>;

export const YesOrNoColors: Record<string, string> = {
  YES: "#46B600",
  NO: "#D93566",
};
