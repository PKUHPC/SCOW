import { z } from "zod";

export const ExtensionRouteQuery = z.object({
  scowUserToken: z.string().optional(),
  scowDark: z.enum(["true", "false"]),
  scowLangId: z.string(),
});

export type ExtensionRouteQuery = z.infer<typeof ExtensionRouteQuery>;

export function isUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

export const getExtensionRouteQuery = (dark: boolean, languageId: string, userToken?: string) =>
  ({
    scowDark: dark ? "true" : "false",
    scowLangId: languageId,
    ...(userToken ? { scowUserToken: userToken } : {}),
  }) as ExtensionRouteQuery;
