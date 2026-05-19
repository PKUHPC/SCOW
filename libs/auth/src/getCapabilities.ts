import { join } from "path";

export interface Capabilities {
  createUser?: boolean;
  checkPassword?: boolean;
  changePassword?: boolean;
  changeEmail?: boolean;
  getUser?: boolean;
  accountUserRelation?: boolean;
  deleteUser?: boolean;
  lockUser?: boolean;
  updatePasswordResetFlag?: boolean;
}

// Cannot use import type
// type Capabilities = import("../../../apps/auth/src/routes/capabilities").Capabilities;

/**
 * Get auth capabilities
 * @param authUrl the url for auth service
 * @returns auth capabilities
 */
export async function getCapabilities(authUrl: string): Promise<Capabilities> {
  return (await (await fetch(join(authUrl, "/capabilities"))).json()) as Capabilities;
}
