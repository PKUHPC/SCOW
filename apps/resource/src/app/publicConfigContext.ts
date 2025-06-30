"use client";


import React, { useContext } from "react";

export const PublicConfigContext = React.createContext<{
  clusterSortedIdList: string[],
}>(undefined!);

export const usePublicConfig = () => {
  return useContext(PublicConfigContext);
};
