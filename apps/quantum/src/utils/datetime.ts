import dayjs from "dayjs";

export function formatDateTime(str: string): string {
  return dayjs(str)
    .format("YYYY-MM-DD HH:mm:ss");
}

export function compareDateTime(a: string, b: string): number {
  const aMoment = dayjs(a);
  const bMoment = dayjs(b);

  if (aMoment.isSame(bMoment)) { return 0; }
  if (aMoment.isBefore(bMoment)) { return -1; }
  return 1;

}

// calculate time to format XX.X seconds
export function formatTime(milliseconds: number): string {
  const seconds = milliseconds / 1000;

  // 保留一位小数
  const formattedSeconds = seconds.toFixed(1);

  return `${formattedSeconds}s`;
}

export function formatTimestamp(timestamp: number, isMillisecond = false) {
  const timestampInSeconds = isMillisecond ? timestamp : timestamp * 1000;
  const date = new Date(timestampInSeconds);

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
