import type { ScowMetadata } from "src/api/metadata";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { createRestClient } from "src/api/http";
import { getSessionSource } from "src/api/sessionPaths";
import { USE_MOCK } from "src/config/runtime";

export { getLoginPath } from "src/api/sessionPaths";

export const sessionKey = ["app", "session"] as const;

async function getSession(metadata: ScowMetadata) {
  const source = getSessionSource(metadata);
  if (!source) return { authenticated: true };

  try {
    const client = createRestClient(source);
    if (source === "ai") {
      const response = await client.get<{ user?: { identityId?: string } }>("/auth/userInfo");
      return { authenticated: Boolean(response.data.user?.identityId) };
    }
    const response = await client.get<{ userInfo?: { identityId?: string } }>("/getAppInitialConfig");
    return { authenticated: Boolean(response.data.userInfo?.identityId) };
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      return { authenticated: false };
    }
    throw error;
  }
}

export const useSessionQuery = (metadata: ScowMetadata | undefined) =>
  useQuery({
    queryKey: [...sessionKey, metadata?.components],
    queryFn: async () => (USE_MOCK ? { authenticated: true } : getSession(metadata!)),
    enabled: USE_MOCK || metadata !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
