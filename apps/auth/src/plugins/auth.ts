import fp from "fastify-plugin";
import { AuthProvider } from "src/auth/AuthProvider";
import { createLdapAuthProvider } from "src/auth/ldap";
import { createSshAuthProvider } from "src/auth/ssh";
import { authConfig } from "src/config/auth";
import { config } from "src/config/env";

declare module "fastify" {
  interface FastifyInstance {
    auth: AuthProvider;
  }
}

const providers = {
  ldap: createLdapAuthProvider,
  ssh: createSshAuthProvider,
} as const;

export const authPlugin = fp(async (f) => {
  const authType = config.AUTH_TYPE || authConfig.authType;

  const provider = providers[authType];

  f.decorate("auth", await provider(f));
});
