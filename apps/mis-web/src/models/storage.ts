import { SortOrder } from "@scow/protos/build/common/sort_order";
import { QuotaSortField } from "@scow/protos/build/server/storage";
import { Static, Type } from "@sinclair/typebox";

export const QuotaSortFieldType = Type.Union([
  Type.Literal("quotaBytes"),
  Type.Literal("usedStorageBytes"),
]);
export type QuotaSortFieldType = Static<typeof QuotaSortFieldType>;

export const mapQuotaSortFieldType = {
  "quotaBytes": QuotaSortField.STORAGE_QUOTA,
  "usedStorageBytes": QuotaSortField.USED_STORAGE_BYTES,
} as Record<string, QuotaSortField>;

export const QuotaSortOrderType = Type.Union([
  Type.Literal("descend"),
  Type.Literal("ascend"),
]);
export type QuotaSortOrderType = Static<typeof QuotaSortOrderType>;

export const mapQuotaSortOrderType = {
  "descend":SortOrder.DESCEND,
  "ascend":SortOrder.ASCEND,
} as Record<string, SortOrder>;
