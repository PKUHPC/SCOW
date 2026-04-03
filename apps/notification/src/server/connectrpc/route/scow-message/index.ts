import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { Knex } from "@mikro-orm/mysql";
import { checkScowApiToken } from "@scow/lib-server/build/api";
import { ReadStatus } from "@scow/notification-protos/build/common_pb";
import { ScowMessageService } from "@scow/notification-protos/build/scow_message_pb";
import { NoticeType } from "src/models/notice-type";
import { commonConfig } from "src/server/config/common";
import { notificationConfig } from "src/server/config/notification";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";
import { Message, SenderType } from "src/server/entities/Message";
import { MessageTarget } from "src/server/entities/MessageTarget";
import { ReadStatus as EntityReadStatus, TargetType, UserMessageRead } from "src/server/entities/UserMessageRead";
import { UserSubscription } from "src/server/entities/UserSubscription";
import { getUser } from "src/utils/auth";
import { checkAuth } from "src/utils/auth/check-auth";
import { toCamelCaseArray } from "src/utils/camelCase";
import { ensureNotUndefined } from "src/utils/ensure-not-undefined";
import { forkEntityManager } from "src/utils/get-orm";
import { logger } from "src/utils/logger";
import { systemBatchSendMsgsToBridge, SystemSendMsgToBridge, systemSendMsgToBridge } from "src/utils/message-bridge";
import { getMessageConfigWithDefault } from "src/utils/message-config";
import { checkMessageTypeExist, getMessagesTypeData } from "src/utils/message-type";

export default (router: ConnectRouter) => {
  router.service(ScowMessageService, {
    async systemSendMessage(req, ctx) {

      await checkScowApiToken(ctx, commonConfig.scowApi);

      const { systemId, targetIds, messageType, metadata, descriptionData } = req;
      const { targetType } = ensureNotUndefined(req, ["targetType"]);

      if (!metadata) {
        throw new ConnectError(
          "The metadata field cannot be empty",
          Code.InvalidArgument,
        );
      }

      const em = await forkEntityManager();

      const messageTypeData = await checkMessageTypeExist(em, messageType);
      if (!messageTypeData) {
        throw new ConnectError(
          `Message type ${messageType} does't exists.`,
          Code.InvalidArgument,
        );
      }

      // TODO: check system id
      const message = new Message({
        senderType: SenderType.SYSTEM,
        senderId: systemId,
        targetType,
        messageType,
        category: messageTypeData.category,
        metadata: metadata,
        descriptionData,
      });

      await em.persistAndFlush(message);

      const adminMessageConfig = await getMessageConfigWithDefault(em, messageType, NoticeType.SITE_MESSAGE);

      for (const userId of targetIds) {
        // 只有管理员开启了该消息且允许用户修改才按照用户订阅来处理，用户订阅有可能一开始不存在，则还是已管理员设置的为准
        let messageEnabled = adminMessageConfig.enabled;
        if (adminMessageConfig.canUserModify && adminMessageConfig.enabled) {
          const userSub = await em.findOne(UserSubscription,
            { userId, messageType, noticeType: NoticeType.SITE_MESSAGE });

          if (userSub) messageEnabled = userSub.isSubscribed;
        }

        if (messageEnabled) {
          const messageTarget = new MessageTarget({
            noticeTypes: [NoticeType.SITE_MESSAGE],
            targetId: userId,
            targetType: TargetType.USER,
            message,
          });
          await em.persistAndFlush(messageTarget);
        }
      }

      if (notificationConfig.messageBridge) {
        systemSendMsgToBridge(em, {
          senderType: SenderType.SYSTEM, senderId: systemId,
          category: messageTypeData.category,
          targetType, targetIds, messageType,
          metadata,
        });
      }

      return {};
    },

    async systemBatchSendMessages(req, ctx) {

      await checkScowApiToken(ctx, commonConfig.scowApi);

      const { systemId, messages } = req;
      const em = await forkEntityManager();
      const adminMessageConfigMap = new Map<string, Pick<AdminMessageConfig, "enabled" | "canUserModify"> | null>();

      const bridgeMessages: SystemSendMsgToBridge[] = [];
      for (const msg of messages) {
        let messageConfig = adminMessageConfigMap.get(msg.messageType);
        const { targetIds, messageType, metadata, descriptionData } = msg;
        const { targetType } = ensureNotUndefined(msg, ["targetType"]);

        if (!metadata) {
          throw new ConnectError(
            "The metadata field cannot be empty",
            Code.InvalidArgument,
          );
        }

        const messageTypeData = await checkMessageTypeExist(em, messageType);
        if (!messageTypeData) {
          throw new ConnectError(
            `Message type ${messageType} does't exists.`,
            Code.InvalidArgument,
          );
        }

        // TODO: check system id
        const message = new Message({
          senderType: SenderType.SYSTEM,
          senderId: systemId,
          targetType,
          messageType,
          category: messageTypeData.category,
          metadata: metadata,
          descriptionData,
        });

        em.persist(message);

        if (!messageConfig && !adminMessageConfigMap.has(msg.messageType)) {
          messageConfig = await getMessageConfigWithDefault(em, messageType, NoticeType.SITE_MESSAGE);
          adminMessageConfigMap.set(msg.messageType, messageConfig);
        }

        const adminMessageConfig = await getMessageConfigWithDefault(em, messageType, NoticeType.SITE_MESSAGE);

        for (const userId of targetIds) {
          // 只有管理员开启了该消息且允许用户修改才按照用户订阅来处理，用户订阅有可能一开始不存在，则还是已管理员设置的为准
          let messageEnabled = adminMessageConfig.enabled;
          if (adminMessageConfig.canUserModify && adminMessageConfig.enabled) {
            const userSub = await em.findOne(UserSubscription,
              { userId, messageType, noticeType: NoticeType.SITE_MESSAGE });

            if (userSub) messageEnabled = userSub.isSubscribed;
          }

          if (messageEnabled) {
            const messageTarget = new MessageTarget({
              noticeTypes: [NoticeType.SITE_MESSAGE],
              targetId: userId,
              targetType: TargetType.USER,
              message,
            });
            em.persist(messageTarget);
          }
        }

        bridgeMessages.push({
          senderType: SenderType.SYSTEM, senderId: systemId,
          category: messageTypeData.category,
          targetType, targetIds, messageType,
          metadata,
        });
      }

      await em.flush();

      if (notificationConfig.messageBridge) {
        systemBatchSendMsgsToBridge(em, bridgeMessages);
      }

      return {};
    },

    async listMessages(req, ctx) {
      const { userId, category, noticeType, messageType, messageTypes, readStatus, page, pageSize } = req;
      const effectiveMessageTypes = messageTypes.length > 0
        ? messageTypes
        : messageType ? [messageType] : [];

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);

      if (!user) {
        throw new ConnectError("user does not exists.", Code.InvalidArgument);
      }

      const em = await forkEntityManager();
      const knex = em.getConnection().getKnex();

      // 构建子查询：从 message_targets 表获取符合条件的 message_id
      const mtSubquery = knex("message_targets as mt")
        .select("mt.message_id")
        .where(function() {
          this.where("mt.notice_types", "like", `%${noticeType}%`)
            .andWhere(function() {
              this.where("mt.target_type", TargetType.FULL_SITE)
                // .orWhere(function() {
                //   this.where("mt.target_type", TargetType.TENANT)
                //     .andWhere("mt.target_id", user.tenant);
                // })
                // .orWhere(function() {
                //   this.where("mt.target_type", TargetType.ACCOUNT)
                //     .andWhere("mt.target_id", "in", user.accountAffiliations.map((a) => a.accountName));
                // })
                .orWhere(function() {
                  this.where("mt.target_type", TargetType.USER)
                    .andWhere("mt.target_id", user.identityId);
                });
            });
        });

      // 构建子查询：从 messages 表获取 sender_type = PLATFORM_ADMIN 的 message_id
      const mSubquery = knex("messages as m")
        .select("m.id as message_id")
        .where("m.sender_type", SenderType.PLATFORM_ADMIN);

      // 使用 UNION 合并两个子查询
      const unionSubquery = knex.union([
        mtSubquery,
        mSubquery,
      ], true).as("message_ids");

      // 构建读取状态的查询条件
      let readConditions;
      switch (readStatus) {
        case ReadStatus.UNREAD:
          readConditions = function(this: Knex.QueryBuilder) {
            this.whereNotIn("m.id", function(this: Knex.QueryBuilder) {
              this.select("umr.message_id as message_id")
                .where("umr.status", ReadStatus.READ);
            })
              .orWhere(function(this: Knex.QueryBuilder) {
                this.where("umr.status", EntityReadStatus.UNREAD)
                  .andWhere("umr.is_deleted", false);
              });
          };
          break;
        case ReadStatus.READ:
          readConditions = function(this: Knex.QueryBuilder) {
            this.where("umr.status", EntityReadStatus.READ)
              .andWhere("umr.is_deleted", false);
          };
          break;
        default:
          // 如果是 ALL 或未指定 readStatus，则不添加额外条件
          readConditions = function(this: Knex.QueryBuilder) {
            this.whereNotIn("m.id", function(this: Knex.QueryBuilder) {
              this.select("umr.message_id as message_id")
                .where("umr.is_deleted", true);
            });
          };
          break;
      }

      // 确保 pageSize 是 number 类型
      const DEFAULT_PAGE_SIZE = 10; // 设置默认的每页数量
      const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE;
      const effectivePage = page ?? 1;

      // 构建最终查询
      const query = knex("messages as m")
        .leftJoin("user_message_read as umr", function() {
          this.on("m.id", "=", "umr.message_id")
            .andOn("umr.user_id", "=", knex.raw("?", [user.identityId]));
        })
        .whereIn("m.id", knex.select("message_id").from(unionSubquery))
        .andWhere(readConditions)
        .andWhere(function() {
          this.where("m.expired_at", ">", new Date()) // expired_at 大于当前时间
            .orWhereNull("m.expired_at"); // 或者 expired_at 为 null
        })
        .modify(function(queryBuilder) {
          if (category) {
            queryBuilder.andWhere("m.category", category);
          }
          if (effectiveMessageTypes.length > 0) {
            queryBuilder.andWhere("m.message_type", "in", effectiveMessageTypes);
          }
        })
        .orderBy("m.created_at", "DESC")
        .limit(effectivePageSize)
        .offset((effectivePage - 1) * effectivePageSize)
        .select("m.*", "umr.status as umr_status");

      // 获取消息列表和总数
      const [messages, [{ total }]] = await Promise.all([
        query,
        knex("messages as m")
          .countDistinct("m.id as total")
          .leftJoin("user_message_read as umr", function() {
            this.on("m.id", "=", "umr.message_id")
              .andOn("umr.user_id", "=", knex.raw("?", [user.identityId]));
          })
          .whereIn("m.id", knex.select("message_id").from(unionSubquery))
          .andWhere(readConditions)
          .andWhere(function() {
            this.where("m.expired_at", ">", new Date()) // expired_at 大于当前时间
              .orWhereNull("m.expired_at"); // 或者 expired_at 为 null
          })
          .modify(function(queryBuilder) {
            if (category) {
              queryBuilder.andWhere("m.category", category);
            }
            if (messageType) {
              queryBuilder.andWhere("m.message_type", messageType);
            }
          }),
      ]);

      const camelCaseMessage = toCamelCaseArray<(Message & { umrStatus: ReadStatus })[]>(messages);
      const messagesTypeDataMap = await getMessagesTypeData(em, camelCaseMessage);

      return {
        totalCount: BigInt(total),
        messages: camelCaseMessage.filter((m) => messagesTypeDataMap.has(m.messageType)).map((m) => ({
          ...m,
          id: BigInt(m.id),
          metadata: m.metadata,
          messageType: messagesTypeDataMap.get(m.messageType)!,
          isRead: m.umrStatus === ReadStatus.READ ? true : false,
          createdAt: new Date(m.createdAt).toISOString(),
          updatedAt: new Date(m.updatedAt).toISOString(),
        })),
      };
    },

    async markMessageRead(req, ctx) {
      const { userId, messageId } = req;

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);
      if (!user) {
        throw new ConnectError(`user ${userId} does not exists.`, Code.InvalidArgument);
      }

      const em = await forkEntityManager();

      // 检查这条消息是否是发给该用户的
      const message = await em.findOne(Message, {
        id: Number(messageId),
        $or: [
          { messageTarget: { targetType: TargetType.FULL_SITE } },
          // { messageTarget: { targetType: TargetType.TENANT, targetId: user.tenant } },
          // { messageTarget: { targetType: TargetType.ACCOUNT, targetId:
          // { $in: user.accountAffiliations.map((a) => a.accountName) } } },
          { messageTarget: { targetType: TargetType.USER, targetId: user.identityId } },
        ],
      });

      if (!message) {
        throw new ConnectError(
          `User ${user.identityId} can't read message ${messageId}`,
          Code.PermissionDenied,
        );
      }

      await em.upsert(UserMessageRead, {
        userId: user.identityId, message, readTime: new Date(), status: EntityReadStatus.READ,
      }, { onConflictFields: ["userId", "message"]});

      return {};
    },
  });
};
