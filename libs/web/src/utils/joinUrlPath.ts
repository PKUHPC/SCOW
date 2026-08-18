export const joinUrlPath = (...segments: string[]) =>
  segments
    .filter(Boolean)
    .join("/")
    .replace(/([^:]\/)\/+/g, "$1");
