import { styled } from "styled-components";

export const FullWidthContainer = styled.div`
  margin: -16px;
  padding: 0;
  width: calc(100% + 32px);
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

export const validateMountPoints = (
  mountsDuplicateText: string,
  workingDirText: string = "",
) => ({ getFieldValue }: { getFieldValue: (name: string) => any }) => ({
  validator(_: any, value?: string) {
    const currentValueNormalized = (value ?? "").replace(/\/+$/, "");

    const rawMountPoints: unknown[] = getFieldValue("mountPoints") ?? [];
    const mountPoints = rawMountPoints
      .map((mountPoint): string | undefined => {
        if (!mountPoint) { return undefined; }
        if (typeof mountPoint === "string") { return mountPoint; }
        if (typeof mountPoint === "object" && "source" in mountPoint) {
          const source = (mountPoint as { source?: unknown }).source;
          return typeof source === "string" ? source : undefined;
        }
        return undefined;
      })
      .filter((mountPoint): mountPoint is string => Boolean(mountPoint))
      .map((mountPoint) => mountPoint.replace(/\/+$/, ""));

    const currentIndex = mountPoints.findIndex((point) => point === currentValueNormalized);

    const otherMountPoints = mountPoints.filter((_, idx) => idx !== currentIndex);
    if (otherMountPoints.includes(currentValueNormalized)) {
      return Promise.reject(new Error(mountsDuplicateText));
    }

    const workingDirectory = getFieldValue("customFields")?.workingDir?.toString();
    if (workingDirectory && workingDirectory.replace(/\/+$/, "") === currentValueNormalized) {
      return Promise.reject(new Error(workingDirText));
    }

    return Promise.resolve();
  },
});

export const validateEnvKeyFormat = (
  invalidFormatText: string,
  duplicateText: string,
) => ({ getFieldValue }: { getFieldValue: (name: string) => any }) => ({
  validator(_: any, value: string) {
    // 正则校验，检查环境变量名称格式
    const pattern = /^[A-Z_][A-Z0-9_]*$/;
    if (!value || pattern.test(value)) {
      // 如果格式合法，继续检查重复性
      const envVariables: string[] = getFieldValue("envVariables")
        .filter((env: any) => env?.key)
        .map((env: any) => env.key.replace(/\/+$/, ""));

      // 检查是否已有相同的环境变量名称
      const currentIndex = envVariables.indexOf(value);
      const otherEnvVariables = envVariables.filter((_, idx) => idx !== currentIndex);

      if (otherEnvVariables.includes(value)) {
        return Promise.reject(new Error(duplicateText));
      }

      return Promise.resolve();
    }

    return Promise.reject(new Error(invalidFormatText)); // 如果格式不合法，返回格式错误
  },
});
