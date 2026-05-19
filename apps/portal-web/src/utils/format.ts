import { Lang } from "react-typed-i18n";
import en from "src/i18n/en";

const DEFAULT_UNIT_MAP = ["KB", "MB", "GB", "TB", "PB"];

/**
 * @description 传入size的单位应为unitMap的最小单位，默认传入KB
 * @param size
 * @param unitMap
 * @returns
 */
export const formatSize = (size: number, unitMap: string[] = DEFAULT_UNIT_MAP): string => {
  const CARRY = 1024;
  const maxSize = Math.pow(CARRY, unitMap.length);

  if (size >= maxSize) {
    return "";
  }

  let carryCount = 0;

  while (size > CARRY) {
    size = size / CARRY;
    carryCount++;
  }

  if (size >= 1000) {
    size = size / CARRY;
    carryCount++;
  }

  const fixedNumber = size < 9.996 ? 2 : size < 99.95 ? 1 : 0;
  return `${size.toFixed(fixedNumber)} ${unitMap[carryCount]}`;
};

export function convertToBytes(sizeStr: string): number {
  const units = {
    K: 1024,
    M: 1024 * 1024,
    G: 1024 * 1024 * 1024,
  };
  const unit = sizeStr.slice(-1).toUpperCase();
  const size = parseFloat(sizeStr);

  return size * units[unit];
}

export type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;
export function formatMinutesToI18nDayHours(minutes: number, t: TransType): string {
  const minutesInDay = 1440;
  const minutesInHour = 60;

  const days = Math.floor(minutes / minutesInDay);
  const remainingMinutes = minutes % minutesInDay;
  const hours = Math.floor(remainingMinutes / minutesInHour);
  const mins = remainingMinutes % minutesInHour;

  const result: string[] = [];
  if (days > 0) result.push(`${days} ${t("pageComp.app.launchAppForm.day")}`);
  if (hours > 0) result.push(`${hours} ${t("pageComp.app.launchAppForm.hour")}`);
  if (mins > 0) result.push(`${mins} ${t("pageComp.app.launchAppForm.minute")}`);

  return result.join(" ");
}
