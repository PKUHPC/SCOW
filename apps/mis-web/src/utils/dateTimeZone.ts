import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

function formatToLocalTime(isoString: string) {
  return dayjs(isoString)
    .tz("Asia/Shanghai") // 转为东八区时间
    .format("YYYY-MM-DD"); // 格式化为目标形式
}

export function formatLastTime(isoStrings: (string | undefined)[]): string {
  const validIsoStrings = isoStrings.filter((i): i is string => i !== undefined);

  if (validIsoStrings.length === 0) {
    return "";
  }

  // 找到最后一个时间
  const latestIsoString = validIsoStrings.reduce((latest, current) =>
    new Date(latest) > new Date(current) ? latest : current,
  );

  // 格式化最后的时间
  return formatToLocalTime(latestIsoString);
}
