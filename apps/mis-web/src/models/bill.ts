import { ValueOf } from "next/dist/shared/lib/constants";

export const BillType = {
  SUMMARY: 0,
  MONTHLY: 1,
  YEARLY: 2,
} as const;

export type BillType = ValueOf<typeof BillType>;
