import dayjs from "dayjs";

// 比较可能为空值或者无法解析的时间
// 空值认为最小
export function compareNullableDateTime(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 {
  // null / undefined / "" 当成最小时间
  const toDayjsOrMin = (v: string | null | undefined) => {
    if (!v) return dayjs(0);
    // 其他解析失败也当成最小时间
    const d = dayjs(v);
    return d.isValid() ? d : dayjs(0);
  };

  const am = toDayjsOrMin(a);
  const bm = toDayjsOrMin(b);

  if (am.isSame(bm)) return 0;
  return am.isBefore(bm) ? -1 : 1;
}

// 用于Undefined表示永久有效的时间比较
// 空值认为最大
export function compareNullableDateTimeAsMax(a: string | undefined, b: string | undefined): -1 | 0 | 1 {
  const toSortableValue = (v: string | undefined) => {
    if (v === undefined) {
      // undefined = 永久有效 = 最大值
      return Number.POSITIVE_INFINITY;
    }
    const d = dayjs(v);
    if (!d.isValid()) {
      // 无法解析的字符串 = 最小值
      return Number.NEGATIVE_INFINITY;
    }
    // 正常日期
    return d.valueOf();
  };

  const av = toSortableValue(a);
  const bv = toSortableValue(b);

  if (av === bv) return 0;
  return av < bv ? -1 : 1;
}

// 比较可能为空值的字符串
export function compareNullableString(a: string | null | undefined, b: string | null | undefined): number {
  const sa = a ?? "";
  const sb = b ?? "";

  return sa.localeCompare(sb);
}

// 比较可能为空值的数字
export function compareNullableNumber(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): -1 | 0 | 1 {
  const toNumberOrMin = (v: number | string | null | undefined): number => {
    if (v === null || v === undefined || v === "") {
      // 所有无值都当成最小
      return Number.NEGATIVE_INFINITY;
    }
    const n = typeof v === "number" ? v : Number(v);
    // 解析失败 NaN 也当成最小
    return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
  };

  const na = toNumberOrMin(a);
  const nb = toNumberOrMin(b);

  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}

// 比较可能为空的文件权限
export function compareNullableFileMode(a: number | null | undefined, b: number | null | undefined): -1 | 0 | 1 {
  const pa = getPermBitsForSorter(a);
  const pb = getPermBitsForSorter(b);

  if (pa === pb) return 0;
  return pa < pb ? -1 : 1;
}

// 获取权限 mode 的可排序的十进制数值大小
// 没有权限值 返回 -1
const getPermBitsForSorter = (mode: number | null | undefined) => {
  if (mode === undefined || mode === null) {
    return -1;
  }
  // 按位与(bitwise AND)，只保留权限位（rwxrwxrwx -> 0o777）
  // 把 mode 的低 9 位（权限位）取出来，去掉其他无关位
  return mode & 0o777;
};
