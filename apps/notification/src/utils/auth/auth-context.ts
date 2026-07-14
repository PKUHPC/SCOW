import { createContextKey } from "@connectrpc/connect";
import type { UserInfo } from "src/models/user";

export const authUserInfoContextKey = createContextKey<Promise<UserInfo | undefined> | undefined>(undefined, {
  description: "notification auth user info",
});
