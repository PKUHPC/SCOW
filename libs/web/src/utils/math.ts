export function max(op1: number, op2: number) {
  return op1 > op2 ? op1 : op2;
}
export function min(op1: number, op2: number) {
  return op1 < op2 ? op1 : op2;
}

export function compareNumber(a: number, b: number): -1 | 0 | 1 {
  if (a === b) {
    return 0;
  }
  if (a < b) {
    return -1;
  }
  return 1;
}

export function compareTimeAsSeconds(
  time1: string,
  time2: string,
  separatorHours: string = ":",
  separatorDays: string = "-",
): number {
  // 将时间字符串转换为秒数
  function timeToSeconds(time: string): number {
    let days = 0;
    const timePart = time?.trim();
    if (!timePart) {
      return Number.NEGATIVE_INFINITY;
    }
    let hours = 0,
      minutes = 0,
      seconds = 0;
    // 检查是否有天数部分
    if (time.includes("-")) {
      const parts = timePart.split("-");
      days = parseInt(parts[0]);
      [hours, minutes, seconds] = parts[1].split(separatorDays).map(Number);
    } else {
      const segments = timePart.split(separatorHours).map(Number);
      if (segments.length === 3) {
        [hours, minutes, seconds] = segments;
      } else if (segments.length === 2) {
        [minutes, seconds] = segments;
      } else {
        seconds = segments[0];
      }
    }
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  const seconds1 = timeToSeconds(time1);
  const seconds2 = timeToSeconds(time2);

  // 返回两个时间的秒数差
  return seconds1 - seconds2;
}
