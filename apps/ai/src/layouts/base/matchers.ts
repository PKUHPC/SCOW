import type { NavItemProps } from "src/layouts/base/NavItemProps";

export type Matcher = (spec: string, path: string) => boolean;

const removeQuery = (path: string) => path.split("?", 1)[0];

export const exactMatch: Matcher = (spec, path) => {
  return path === spec;
};

export const startsWithMatch: Matcher = (spec, path) => {
  const normalizedPath = path.endsWith("/") ? path.substring(0, path.length - 1) : path;
  // avoid /test matches /test-test
  return normalizedPath === spec || normalizedPath.startsWith(spec) || normalizedPath.startsWith(spec + "/");
};

export const match = (item: NavItemProps, path: string) => {
  return (item.match ?? startsWithMatch)(item.path, removeQuery(path));
};
