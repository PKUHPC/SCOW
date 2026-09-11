import { SortOrder } from "@scow/protos/build/common/sort_order";
import { QuotaSortField } from "@scow/protos/build/server/storage";
import { Static, Type } from "@sinclair/typebox";

export const QuotaSortFieldType = Type.Union([
  Type.Literal("quotaMb"),
  Type.Literal("usedStorageMb"),
]);
export type QuotaSortFieldType = Static<typeof QuotaSortFieldType>;

export const mapQuotaSortFieldType = {
  "quotaMb": QuotaSortField.STORAGE_QUOTA,
  "usedStorageMb": QuotaSortField.USED_STORAGE_MB,
} as Record<string, QuotaSortField>;

export const QuotaSortOrderType = Type.Union([Type.Literal("descend"), Type.Literal("ascend")]);
export type QuotaSortOrderType = Static<typeof QuotaSortOrderType>;

export const mapQuotaSortOrderType = {
  descend: SortOrder.DESCEND,
  ascend: SortOrder.ASCEND,
} as Record<string, SortOrder>;
