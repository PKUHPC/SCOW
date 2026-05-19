import { dump } from "js-yaml";

const formatters: Record<string, (value: any) => string> = {
  json: JSON.stringify,
  yaml: dump,
};

export const format = (value: any, format: string) => {
  const formatter = formatters[format];

  if (!formatter) {
    throw new Error("Unknown format " + format);
  }

  return formatter(value);
};
