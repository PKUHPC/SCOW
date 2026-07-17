import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import path from "path";

/**
 * 解析提交作业工作目录。
 *
 * - 用户填写绝对路径时，仅做 path.normalize 后原样使用；
 * - 用户填写相对路径时，按用户家目录解析为 `${userHomeDir}/${workingDirectory}`；
 * - 相对路径解析后必须仍位于用户家目录下，避免通过 `..` 等路径段逃逸。
 */
export const resolveSubmitJobWorkingDirectory = (workingDirectory: string, userHomeDir: string) => {
  if (path.isAbsolute(workingDirectory)) {
    return path.normalize(workingDirectory);
  }

  const normalizedHomeDir = path.resolve(userHomeDir);
  const resolvedWorkingDirectory = path.resolve(normalizedHomeDir, workingDirectory);
  const homeDirWithTrailingSlash = normalizedHomeDir.endsWith(path.sep)
    ? normalizedHomeDir
    : `${normalizedHomeDir}${path.sep}`;

  if (resolvedWorkingDirectory !== normalizedHomeDir && !resolvedWorkingDirectory.startsWith(homeDirWithTrailingSlash)) {
    throw {
      code: status.INVALID_ARGUMENT,
      details: "Relative working directory must be under user's home directory",
    } as ServiceError;
  }

  return resolvedWorkingDirectory;
};
