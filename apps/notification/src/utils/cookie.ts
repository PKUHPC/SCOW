export const getCookieValue = (cookie: string, name: string) => {
  const match = new RegExp("(^| )" + name + "=([^;]+)").exec(cookie);
  if (match) return match[2];
  return null;
};
