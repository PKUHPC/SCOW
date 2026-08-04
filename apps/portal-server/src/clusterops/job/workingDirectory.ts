import { Status } from "@grpc/grpc-js/build/src/constants";
import { DetailedError, encodeMessage, ErrorInfo } from "@scow/rich-error-model";
import { validateRelativeToHomePath } from "@scow/utils";
import path from "path";

const errorInfo = (reason: string) => encodeMessage(ErrorInfo, { domain: "", reason, metadata: {} });

const invalidArgument = (details: string) =>
  new DetailedError({
    code: Status.INVALID_ARGUMENT,
    message: details,
    details: [errorInfo("INVALID ARGUMENT")],
  });

/**
 * 解析提交作业的工作目录。
 *
 * - 绝对路径位于 userHomeDir 下时，规范化后返回；
 * - 相对路径按 `${userHomeDir}/${workingDirectory}` 解析；
 * - 拒绝不安全的路径语法以及逃逸出 userHomeDir 的路径。
 */
export const resolveSubmitJobWorkingDirectory = (workingDirectory: string, userHomeDir: string) => {
  const error = validateRelativeToHomePath(workingDirectory, userHomeDir);
  if (error) {
    throw invalidArgument(error);
  }

  if (path.isAbsolute(workingDirectory)) {
    return path.normalize(workingDirectory);
  }

  const normalizedHomeDir = path.resolve(userHomeDir);
  const resolvedWorkingDirectory = path.resolve(normalizedHomeDir, workingDirectory);
  const homeDirWithTrailingSlash = normalizedHomeDir.endsWith(path.sep)
    ? normalizedHomeDir
    : `${normalizedHomeDir}${path.sep}`;

  if (
    resolvedWorkingDirectory !== normalizedHomeDir &&
    !resolvedWorkingDirectory.startsWith(homeDirWithTrailingSlash)
  ) {
    throw invalidArgument("Relative working directory must be under user's home directory");
  }

  return resolvedWorkingDirectory;
};
