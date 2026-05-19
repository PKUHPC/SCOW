import { TimeRangePickerProps } from "antd";
import dayjs from "dayjs";

import { getCurrentLangLibWebText } from "./libWebI18n/libI18n";

export function formatDateTime(str: string): string {
  return dayjs(str).format("YYYY-MM-DD HH:mm:ss");
}

export const getDefaultPresets = (languageId: string): TimeRangePickerProps["presets"] => {
  const now = dayjs();
  const end = now.endOf("day");

  const today = getCurrentLangLibWebText(languageId, "dateTimeToday");
  const tWeek = getCurrentLangLibWebText(languageId, "dateTimeTWeek");
  const tMonth = getCurrentLangLibWebText(languageId, "dateTimeTMonth");
  const tYear = getCurrentLangLibWebText(languageId, "dateTimeTYear");
  const threeMonths = getCurrentLangLibWebText(languageId, "dateTimeThreeMonths");
  const sixMonths = getCurrentLangLibWebText(languageId, "dateTimeSixMonths");
  const oneYear = getCurrentLangLibWebText(languageId, "dateTimeOneYear");

  return [
    { label: today, value: [now.startOf("day"), end] },
    { label: tWeek, value: [now.startOf("week"), end] },
    { label: tMonth, value: [now.startOf("month"), end] },
    { label: tYear, value: [now.startOf("year"), end] },
    { label: threeMonths, value: [now.subtract(3, "month").startOf("day"), end] },
    { label: sixMonths, value: [now.subtract(6, "month").startOf("day"), end] },
    { label: oneYear, value: [now.subtract(1, "year").startOf("day"), end] },
  ];
};

export function compareDateTime(a: string, b: string): number {
  const aMoment = dayjs(a);
  const bMoment = dayjs(b);

  if (aMoment.isSame(bMoment)) {
    return 0;
  }
  if (aMoment.isBefore(bMoment)) {
    return -1;
  }
  return 1;
}

// Parse the given string in [{days}-][{Hours}:]{MM}:{SS} format and return number of milliseconds
export function parseTime(time: string) {
  const list = time.split(/[:-]/).map((x) => +x);

  const seconds = list.at(-1);
  const minutes = list.at(-2);
  const hours = list.at(-3) ?? 0;
  const days = list.at(-4) ?? 0;

  return seconds! * 1000 + minutes! * 60000 + hours * 3600000 + days * 86400000;
}

export enum TimeUnits {
  MINUTE = "MINUTE",
  HOUR = "HOUR",
  DAY = "DAY",
}
// Parse the given number of time value and time unit, return number of minutes
export const parseMinutes = (time: number, unit: TimeUnits): number => {
  switch (unit) {
    case TimeUnits.MINUTE:
      return time;
    case TimeUnits.HOUR:
      return time * 60;
    case TimeUnits.DAY:
      return time * 60 * 24;
  }
};
