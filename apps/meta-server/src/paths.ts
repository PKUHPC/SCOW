export const META_BASE_PATH = "/meta";

export function metaBasePath(basePath: string) {
  return `${basePath === "/" ? "" : basePath}${META_BASE_PATH}`;
}
