/**
 * 统计一个字符串在另一个字符串中出现的次数
 * @param {string} str 源字符串
 * @param {string} substring 子字符串
 */
export const countSubstringOccurrences = (str: string, substring: string): number => {
  if (substring === "") {
    return 0;
  }
  return str.split(substring).length - 1;
};
