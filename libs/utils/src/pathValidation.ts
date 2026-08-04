export interface PathValidationMessages {
  unsafeCharacter?: string;
  pathTraversal?: string;
  currentDirectory?: string;
  absoluteRequired?: string;
  rootNotAllowed?: string;
  systemPathNotAllowed?: string;
  homeDirRequired?: string;
  notInHomeDir?: string;
}

export const DEFAULT_FORBIDDEN_CONTAINER_PATHS = [
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/lib",
  "/lib64",
  "/proc",
  "/root",
  "/run",
  "/sbin",
  "/sys",
  "/usr",
  "/var",
];

const UNSAFE_PATH_CHAR_PATTERN = /[\s\u0000-\u001F\u007F,;|&><`$"'\\*?[\]{}()]/;

const trimTrailingSlashes = (path: string) => {
  const trimmedPath = path.replace(/\/+$/, "");
  return trimmedPath === "" && path.startsWith("/") ? "/" : trimmedPath;
};

export const normalizePathForValidation = (path: string) => {
  if (path === "") {
    return path;
  }

  const isAbsolute = path.startsWith("/");
  const segments: string[] = [];

  for (const segment of path.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!isAbsolute) {
        segments.push(segment);
      }
      continue;
    }

    segments.push(segment);
  }

  const normalizedPath = `${isAbsolute ? "/" : ""}${segments.join("/")}`;
  return trimTrailingSlashes(normalizedPath || (isAbsolute ? "/" : "."));
};

const splitPathSegments = (path: string) => path.split("/").filter(Boolean);

export const isSameOrChildPath = (parentPath: string, childPath: string) => {
  const normalizedParentPath = normalizePathForValidation(parentPath);
  const normalizedChildPath = normalizePathForValidation(childPath);

  if (normalizedParentPath === "/") {
    return normalizedChildPath.startsWith("/");
  }

  return normalizedChildPath === normalizedParentPath || normalizedChildPath.startsWith(`${normalizedParentPath}/`);
};

const validateSafePathValue = (
  value: unknown,
  messages: PathValidationMessages,
  options?: { absolute?: boolean; forbidCurrentDirectory?: boolean },
) => {
  if (!value) {
    return undefined;
  }

  const path = String(value);
  if (UNSAFE_PATH_CHAR_PATTERN.test(path)) {
    return messages.unsafeCharacter ?? "路径不能包含空格、逗号或特殊字符";
  }

  if (options?.absolute && !path.startsWith("/")) {
    return messages.absoluteRequired ?? "路径必须以 / 开头";
  }

  const segments = splitPathSegments(path);
  if (segments.includes("..")) {
    return messages.pathTraversal ?? "路径不能包含 ..";
  }

  if (options?.forbidCurrentDirectory && segments.includes(".")) {
    return messages.currentDirectory ?? "路径不能包含 .";
  }

  return undefined;
};

export const validateSafePath = (value: unknown, messages: PathValidationMessages = {}) =>
  validateSafePathValue(value, messages);

export const validateLinuxAbsolutePath = (
  value: unknown,
  messages: PathValidationMessages = {},
  options: { rootAllowed?: boolean } = {},
) => {
  const error = validateSafePathValue(value, messages, { absolute: true, forbidCurrentDirectory: true });
  if (error) {
    return error;
  }

  if (value && !options.rootAllowed && trimTrailingSlashes(String(value)) === "/") {
    return messages.rootNotAllowed ?? "路径不能为根目录 (/)";
  }

  return undefined;
};

export const validateRelativeToHomePath = (
  value: unknown,
  homeDir: string | undefined,
  messages: PathValidationMessages = {},
) => {
  const error = validateSafePathValue(value, messages, { forbidCurrentDirectory: true });
  if (error) {
    return error;
  }

  if (!value || !String(value).startsWith("/")) {
    return undefined;
  }

  if (!homeDir) {
    return messages.homeDirRequired ?? "无法获取用户家目录";
  }

  if (!isSameOrChildPath(homeDir, String(value))) {
    return messages.notInHomeDir ?? "绝对路径必须位于用户家目录下";
  }

  return undefined;
};

export const validateHomeScopedPath = (
  value: unknown,
  homeDir: string | undefined,
  messages: PathValidationMessages = {},
) => {
  const error = validateSafePathValue(value, messages, { absolute: true, forbidCurrentDirectory: true });
  if (error) {
    return error;
  }

  if (!value) {
    return undefined;
  }

  if (!homeDir) {
    return messages.homeDirRequired ?? "无法获取用户家目录";
  }

  if (!isSameOrChildPath(homeDir, String(value))) {
    return messages.notInHomeDir ?? "路径必须位于用户家目录下";
  }

  return undefined;
};

export const validateContainerMountTargetPath = (
  value: unknown,
  messages: PathValidationMessages = {},
  forbiddenPaths: string[] = DEFAULT_FORBIDDEN_CONTAINER_PATHS,
) => {
  const error = validateSafePathValue(value, messages, { absolute: true, forbidCurrentDirectory: true });
  if (error) {
    return error;
  }

  if (!value) {
    return undefined;
  }

  const targetPath = normalizePathForValidation(String(value));
  if (targetPath === "/") {
    return messages.rootNotAllowed ?? "挂载目标路径不能为根目录 (/)";
  }

  const normalizedForbiddenPaths = forbiddenPaths.map(normalizePathForValidation);
  if (normalizedForbiddenPaths.some((path) => isSameOrChildPath(path, targetPath))) {
    return messages.systemPathNotAllowed ?? "挂载目标路径不能为系统目录";
  }

  return undefined;
};
