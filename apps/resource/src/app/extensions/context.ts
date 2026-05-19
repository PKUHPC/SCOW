"use client";

import React, { useContext } from "react";
import { ClientUserInfo } from "src/server/trpc/route/auth";

export const UserContext = React.createContext<{
  user: ClientUserInfo;
}>(undefined!);

export const useUserInfo = () => {
  return useContext(UserContext);
};
