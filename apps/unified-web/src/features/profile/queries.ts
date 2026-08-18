import type { ProfileData } from "src/features/profile/types";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionKey } from "src/api/session";
import { getProfileClient } from "src/features/profile/client";

const profileKey = ["profile"] as const;

export const useProfileQuery = (enabled = true) =>
  useQuery({
    queryKey: profileKey,
    queryFn: async () => (await getProfileClient()).getProfileData(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useChangeProfileEmailMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newEmail: string) => (await getProfileClient()).changeEmail(newEmail),
    onSuccess: (_, newEmail) => {
      queryClient.setQueryData<ProfileData>(profileKey, (data) =>
        data?.user ? { ...data, user: { ...data.user, email: newEmail } } : data,
      );
    },
  });
};

export const useChangeProfilePasswordMutation = () =>
  useMutation({
    mutationFn: async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      (await getProfileClient()).changePassword(oldPassword, newPassword),
  });

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await getProfileClient()).logout(),
    onSuccess: async () => {
      queryClient.setQueryData<ProfileData>(profileKey, (data) => (data ? { ...data, user: undefined } : data));
      await queryClient.invalidateQueries({ queryKey: sessionKey });
    },
  });
};
