import type { UiExtensionInstallation } from "src/features/uiExtension/types";

export const isHttpUrl = (value: string) => {
  const normalized = value.trim();
  if (!/^https?:\/\//i.test(normalized)) return false;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const URI_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export const isSafeExtensionPath = (value: string) => {
  const normalized = value.trim();
  if (normalized.startsWith("//") || normalized.startsWith("\\\\")) return false;
  return !URI_SCHEME.test(normalized) || isHttpUrl(normalized);
};

const encodePath = (parts: string[]) => parts.map(encodeURIComponent).join("/");

export const getExtensionRoutePath = (extension: UiExtensionInstallation, path: string) => {
  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] ?? path;
  const suffix = match?.[2] ?? "";
  const pathParts = pathname.split("/").filter(Boolean);
  const combined = encodePath([...extension.routePrefix, ...pathParts]);
  return `/extensions${combined ? `/${combined}` : ""}${suffix}`;
};

export const joinExtensionUrl = (baseUrl: string, ...parts: string[]) => {
  const base = baseUrl.replace(/\/+$/, "");
  const path = parts.map((part) => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
  return path ? `${base}/${path}` : base;
};

export const getExtensionPageMatch = (extensions: UiExtensionInstallation[], wildcardPath: string | undefined) => {
  const pathParts = (wildcardPath ?? "").split("/").filter(Boolean).map(decodeURIComponent);
  const candidates = [...extensions].sort((a, b) => b.routePrefix.length - a.routePrefix.length);
  const extension = candidates.find((candidate) =>
    candidate.routePrefix.every((part, index) => pathParts[index] === part),
  );

  return extension
    ? { extension, extensionPath: pathParts.slice(extension.routePrefix.length) }
    : undefined;
};
