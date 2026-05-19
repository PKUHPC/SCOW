import { Static, Type } from "@sinclair/typebox";

import { I18nStringType } from "./i18n";

export interface Cluster {
  id: string;
  name: I18nStringType;
}

export enum ClusterActivationStatus {
  ACTIVATED = 0,
  DEACTIVATED = 1,
}

export const ClusterRuntimeInfoSchema = Type.Object({
  clusterId: Type.String(),
  activationStatus: Type.Enum(ClusterActivationStatus),
  operatorId: Type.Optional(Type.String()),
  operatorName: Type.Optional(Type.String()),
  deactivationComment: Type.Optional(Type.String()),
  updateTime: Type.Optional(Type.String()),
  hpcEnabled: Type.Optional(Type.Boolean()),
});

export type ClusterRuntimeInfo = Static<typeof ClusterRuntimeInfoSchema>;
