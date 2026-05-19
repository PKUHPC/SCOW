import { Static, Type } from "@sinclair/typebox";

export const PaymentSortBy = Type.Union([
  Type.Literal("accountName"),
  Type.Literal("time"),
  Type.Literal("amount"),
  Type.Literal("type"),
  Type.Literal("ipAddress"),
  Type.Literal("operatorId"),
  Type.Literal("comment"),
]);

export type PaymentSortBy = Static<typeof PaymentSortBy>;

export const PaymentSortOrder = Type.Union([Type.Literal("descend"), Type.Literal("ascend")]);

export type PaymentSortOrder = Static<typeof PaymentSortOrder>;
