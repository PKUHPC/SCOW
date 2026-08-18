import { ServiceError } from "@grpc/grpc-js";
import { getNotificationNodeClient } from "@scow/lib-notification/build/index";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { AnyJson } from "@scow/lib-web/build/utils/type";
import { NoticeType, ReadStatus } from "@scow/notification-protos/build/message_common_pb";
import { TRPCError } from "@trpc/server";
import { getUserInfo } from "src/server/auth/server";
import { commonConfig } from "src/server/config/common";
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { logger } from "src/server/utils/logger";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

const TemplateSchema = z.object({
  default: z.string(),
  en: z.string(),
  zhCn: z.string(),
  de: z.string(),
  es: z.string(),
  ja: z.string(),
  ko: z.string(),
  fr: z.string(),
  pt: z.string(),
  ru: z.string(),
});

export const AnyJsonSchema: z.ZodType<AnyJson> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(AnyJsonSchema), z.record(z.string(), AnyJsonSchema)]),
);
const MetadataMapSchema = z.record(z.string(), AnyJsonSchema);

const MessageTypeSchema = z.object({
  type: z.string(),
  titleTemplate: TemplateSchema.optional(),
  contentTemplate: TemplateSchema.optional(),
  category: z.string(),
  categoryTemplate: TemplateSchema.optional(),
});

const MessageSchema = z.object({
  id: z.number(),
  messageType: MessageTypeSchema.optional(),
  metadata: MetadataMapSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const UnreadMessageSchema = z.object({
  totalCount: z.number(),
  messages: z.array(MessageSchema),
});

export const notification = router({
  getUnreadMessages: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/notification/unread-messages",
        tags: ["notification"],
        summary: "获取用户未读消息",
        description: "获取当前用户的未读通知消息",
      },
    })
    .input(
      z.object({
        // Deprecated: use messageTypes instead.
        messageType: z.string().optional(),
        messageTypes: z.array(z.string()).optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }),
    )
    .output(z.object({ results: UnreadMessageSchema.optional() }))
    .query(async ({ input, ctx: { user, req, res } }) => {
      const { messageType, messageTypes, page, pageSize } = input;

      const subLogger = logger.child({ user: user.identityId });

      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const notifClient = getNotificationNodeClient(commonConfig.notification.address);

      try {
        const response = await notifClient.scowMessage.listMessages({
          messageType,
          messageTypes: messageTypes ?? [],
          page,
          pageSize,
          userId: userInfo.identityId,
          readStatus: ReadStatus.UNREAD,
          noticeType: NoticeType.SITE_MESSAGE,
        });

        // 转换响应格式
        return {
          results: {
            totalCount: Number(response.totalCount),
            messages: response.messages.map((msg) => ({
              ...msg,
              id: Number(msg.id),
              metadata: msg.metadata ? JSON.parse(JSON.stringify(msg.metadata)) : undefined,
              createdAt: msg.createdAt,
              updatedAt: msg.updatedAt,
            })),
          },
        };
      } catch (error) {
        subLogger.error(error, "Error fetching unread messages");
        const ex = error as ServiceError;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `get unread messages failed, ${ex.details}`,
        });
      }
    }),

  markMessageRead: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/notification/mark-message-read",
        tags: ["notification"],
        summary: "标记消息为已读",
      },
    })
    .input(
      z.object({
        messageId: z.number(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input: { messageId }, ctx }) => {
      const { user, req } = ctx;

      const subLogger = logger.child({ user: user.identityId });

      const notifClient = getNotificationNodeClient(commonConfig.notification.address);

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.markMessageRead,
        operationTypePayload: { messageId },
      };

      await notifClient.scowMessage
        .markMessageRead({
          userId: user.identityId,
          messageId: BigInt(messageId),
        })
        .then(async () => {
          await callLog(logInfo, OperationResult.SUCCESS);
          return;
        })
        .catch(async (e) => {
          subLogger.error(e, "Error marking message %d read", messageId);
          await callLog(logInfo, OperationResult.FAIL);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "MARK_MESSAGE_READ_ERROR",
          });
        });
    }),
});
