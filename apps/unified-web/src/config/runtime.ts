const enabledValues = new Set(["1", "true"]);

export const USE_MOCK = enabledValues.has((import.meta.env.VITE_USE_MOCK ?? "").toLowerCase());

const normalizeBasePath = (value: string) => {
  if (!value || value === "/") {
    return "";
  }
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
};

const builtScowBasePath = "/@SCOW_BASE_PATH@";

export const SCOW_BASE_PATH = import.meta.env.DEV
  ? normalizeBasePath(import.meta.env.VITE_SCOW_BASE_PATH ?? "")
  : normalizeBasePath(builtScowBasePath);

export const getScowPath = (pathname: string) =>
  `${SCOW_BASE_PATH}/${pathname.replace(/^\/+/, "")}`.replace(/\/$/, "") || "/";
