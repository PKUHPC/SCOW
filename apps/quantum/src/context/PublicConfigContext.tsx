import React, { createContext, useContext } from "react";
import { trpc } from "src/utils/trpc";

// 定义 publicConfig 类型
export interface PublicConfig {
  portalUrl: string;
  basePath: string;
  ENABLE_CHANGE_PASSWORD: boolean;
  PASSWORD_PATTERN?: string;
}

export interface ClientUserInfo {
  identityId: string;
  name?: string;
  token: string;
}

// 创建 Context
const PublicConfigContext = createContext<{
  publicConfig: PublicConfig,
  user: ClientUserInfo,
}>(undefined!);

// 创建 Hook 以便组件中方便使用
export const usePublicConfig = () => {
  const context = useContext(PublicConfigContext);
  if (!context) {
    throw new Error("usePublicConfig must be used within a PublicConfigProvider");
  }
  return context;
};

// 创建 Provider 组件
export const PublicConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const publicConfigQuery = trpc.config.publicConfig.useQuery();
  const getUserInfoQuery = trpc.auth.getUserInfo.useQuery();

  if (publicConfigQuery.isLoading || getUserInfoQuery.isLoading) {
    return <div>Loading...</div>;
  }

  if (publicConfigQuery.isError || !publicConfigQuery.data) {
    throw new Error("Failed to load public config");
  }

  const publicConfig = publicConfigQuery.data;

  if (getUserInfoQuery.isError || !getUserInfoQuery.data) {
    throw new Error("Failed to load public config");
  }

  const user = getUserInfoQuery.data.user;

  return (
    <PublicConfigContext.Provider value={{
      publicConfig,
      user,
    }}
    >
      {children}
    </PublicConfigContext.Provider>
  );
};
