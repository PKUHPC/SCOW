import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotificationClient } from "src/features/notification/client";
import type { ListNotificationMessagesInput, NotificationSubscriptionConfig } from "src/features/notification/types";
import { POPUP_NOTIFICATION_MESSAGE_TYPES } from "src/features/notification/types";

const notificationKey = ["notification"] as const;

const notificationKeys = {
  all: notificationKey,
  messages: (input: ListNotificationMessagesInput) => [...notificationKey, "messages", input] as const,
  unreadCount: (language: string) => [...notificationKey, "unreadCount", language] as const,
  subscriptions: (language: string) => [...notificationKey, "subscriptions", language] as const,
  noticeTypes: [...notificationKey, "noticeTypes"] as const,
};

export const useNotificationMessagesQuery = (input: ListNotificationMessagesInput) =>
  useQuery({
    queryKey: notificationKeys.messages(input),
    queryFn: async () => (await getNotificationClient()).listMessages(input),
  });

export const useUnreadNotificationCountQuery = (language: string, enabled: boolean) =>
  useQuery({
    queryKey: notificationKeys.unreadCount(language),
    queryFn: async () =>
      (
        await (await getNotificationClient()).listMessages({
          language,
          page: 1,
          pageSize: 1,
          unreadOnly: true,
        })
      ).totalCount,
    enabled,
    refetchInterval: 60_000,
  });

export const useUnreadPopupNotificationsQuery = (language: string, enabled: boolean) =>
  useQuery({
    queryKey: notificationKeys.messages({
      language,
      page: 1,
      pageSize: 100,
      unreadOnly: true,
      messageTypes: POPUP_NOTIFICATION_MESSAGE_TYPES,
    }),
    queryFn: async () =>
      (await getNotificationClient()).listMessages({
        language,
        page: 1,
        pageSize: 100,
        unreadOnly: true,
        messageTypes: POPUP_NOTIFICATION_MESSAGE_TYPES,
      }),
    enabled,
    refetchInterval: 300_000,
  });

const useNotificationMutation = (mutationFn: () => Promise<void>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => (await getNotificationClient()).markMessageRead(messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useDeleteNotificationsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageIds: string[]) => (await getNotificationClient()).deleteMessages(messageIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useMarkAllNotificationsReadMutation = () =>
  useNotificationMutation(async () => (await getNotificationClient()).markAllMessagesRead());

export const useDeleteAllReadNotificationsMutation = () =>
  useNotificationMutation(async () => (await getNotificationClient()).deleteAllReadMessages());

export const useNotificationSubscriptionsQuery = (language: string) =>
  useQuery({
    queryKey: notificationKeys.subscriptions(language),
    queryFn: async () => (await getNotificationClient()).listSubscriptions(language),
  });

export const useNotificationNoticeTypesQuery = () =>
  useQuery({
    queryKey: notificationKeys.noticeTypes,
    queryFn: async () => (await getNotificationClient()).listNoticeTypes(),
  });

export const useUpdateNotificationSubscriptionsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (configs: NotificationSubscriptionConfig[]) =>
      (await getNotificationClient()).updateSubscriptions(configs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};
