import { parseKeyValue } from "@scow/lib-config";
import { randomUUID } from "crypto";
import { FastifyRequest } from "fastify";
import { authConfig, getAuthConfig } from "src/config/auth";
import { config } from "src/config/env";

const getMockUsers = () => {
  const configMockUsers = getAuthConfig();

  const envMockUsers = parseKeyValue(config.MOCK_USERS);

  return { ...configMockUsers.mockUsers, ...envMockUsers };
};

/**
 * 生成一个UUID，将此UUID以及对应的用户identityId保存到redis中，并返回token
 */
export async function cacheInfo(identityId: string, req: FastifyRequest): Promise<string> {
  const mockUsers = getMockUsers();

  if (mockUsers[identityId]) {
    req.log.info("Rewrite mock user %s to user %s", identityId, mockUsers[identityId]);
    identityId = mockUsers[identityId];
  }

  const token = randomUUID();

  await req.server.redis.set(token, identityId, "EX", authConfig.tokenTimeoutSeconds);

  return token;
}
