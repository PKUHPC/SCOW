// 如果传递的参数不存在返回 "-"
export const safeGetStringProperty = (property: string | undefined) => {
  return String(property ?? "-");
};
