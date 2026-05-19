export const validateChinese = (rule, value, allowPunctuation = false) => {
  const chineseRegex = allowPunctuation ? /^[\u4e00-\u9fa5，。！？!.?_, ]+$/ : /^[\u4e00-\u9fa5]+$/;
  if (value && !chineseRegex.test(value)) {
    return Promise.reject(new Error("请输入简体中文"));
  }
  return Promise.resolve();
};

export const validateEnglish = (rule, value, allowPunctuation = false) => {
  const englishRegex = allowPunctuation ? /^[A-Za-z,!.?_，。！？ ]+$/ : /^[A-Za-z]+$/;
  if (value && !englishRegex.test(value)) {
    return Promise.reject(new Error("请输入英文"));
  }
  return Promise.resolve();
};
