import { trpc } from "src/server/trpc/api";

export const useUserQuery = () => {
  return trpc.auth.getUserInfo.useQuery(undefined, {
    // user info is never refreshed in the client
    staleTime: Infinity,
  });
};

// export const useLogoutMutation = () => {
//   return trpc.auth.logout.useMutation();
// };

export const useOptionalUser = () => {
  const context = useUserQuery().data?.user;
  return context;
};

export const useUser = () => {
  const user = useOptionalUser();
  if (!user) {
    throw new Error("not logged in");
  }
  return user;
};
