import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { Knex } from "@mikro-orm/mysql";
import { checkScowApiToken } from "@scow/lib-server";
import { ReadStatus } from "@scow/notification-protos/build/common_pb";
import { MessageService } from "@scow/notification-protos/build/message_pb";
import { PlatformRole } from "src/models/user";
import { commonConfig } from "src/server/config/common";
import { notificationConfig } from "src/server/config/notification";
import { AdminMessageConfig } from "src/server/entities/AdminMessageConfig";
import { Message, SenderType } from "src/server/entities/Message";
import { MessageTarget } from "src/server/entities/MessageTarget";
import { ReadStatus as EntityReadStatus, TargetType, UserMessageRead } from "src/server/entities/UserMessageRead";
import { getUser } from "src/utils/auth";
import { checkAuth } from "src/utils/auth/check-auth";
import { toCamelCaseArray } from "src/utils/camelCase";
import { ensureNotUndefined } from "src/utils/ensure-not-undefined";
import { forkEntityManager } from "src/utils/get-orm";
import { logger } from "src/utils/logger";
import { adminSendMsgToBridge } from "src/utils/message-bridge";
import { getMessagesTypeData } from "src/utils/message-type";
import { checkAdminMessageTypeExist } from "src/utils/rendering-message";

export default (router: ConnectRouter) => {
  router.service(MessageService, {
    async adminSendMessage(req, context) {
      const { targetIds, noticeTypes, messageType, title, content, expiredAt } = req;
      const { targetType } = ensureNotUndefined(req, ["targetType"]);

      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to send message.`,
          Code.PermissionDenied,
        );
      }

      const em = await forkEntityManager();

      const messageTypeData = checkAdminMessageTypeExist(messageType);
      if (!messageTypeData) {
        throw new ConnectError(
          `Message type ${messageType} does't exists.`,
          Code.InvalidArgument,
        );
      }

      if (title.length > 20 || content.length > 150) {
        throw new ConnectError(
          "The title length should be less than 20 characters, "
            + "and the content length should be less than 150 characters.",
          Code.InvalidArgument,
        );
      }

      const message = new Message({
        senderType: SenderType.PLATFORM_ADMIN,
        senderId: user.identityId,
        targetType,
        messageType,
        category: messageTypeData.category,
        metadata: { title, content },
        expiredAt: expiredAt ? timestampDate(expiredAt) : undefined,
      });

      await em.persistAndFlush(message);

      if (targetType !== TargetType.USER) {
        if (targetType === TargetType.FULL_SITE) {
          const messageTarget = new MessageTarget({
            targetType,
            noticeTypes,
            message,
          });

          await em.persistAndFlush([messageTarget]);
        } else {
          for (const targetId of targetIds) {
            const messageTarget = new MessageTarget({
              targetType,
              targetId,
              noticeTypes,
              message,
            });

            em.persist(messageTarget);
          }
          await em.flush();
        }
      }

      if (notificationConfig.messageBridge) {
        adminSendMsgToBridge({
          senderType: SenderType.PLATFORM_ADMIN, senderId: user.identityId,
          category: messageTypeData.category, messageType: messageTypeData.type,
          targetType, targetIds, noticeTypes, title, content,
        });
      }

      return {};
    },

    async listMessages(req, ctx) {
      const { userId, category, noticeType, messageType, readStatus, page, pageSize } = req;

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);
      if (!user) {
        throw new ConnectError(`user ${userId} does not exists.`, Code.InvalidArgument);
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
          if (messageType) {
            queryBuilder.andWhere("m.message_type", messageType);
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

      return {
        // ...readRecord,
        // messageId: message.id,
        // readTime: readRecord.readTime?.toISOString() ?? new Date().toISOString(),
        // createdAt: readRecord.createdAt.toISOString(),
        // updatedAt: readRecord.updatedAt.toISOString(),
      };
    },

    async markAllMessagesRead(req, ctx) {
      const { userId } = req;

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);

      if (!user) {
        throw new ConnectError(`user ${userId} does not exists.`, Code.InvalidArgument);
      }

      const em = await forkEntityManager();
      const knex = em.getConnection().getKnex();

      const batchSize = 100; // 每批处理的消息数量
      let lastProcessedId: bigint | null = null; // 用于分页查询
      let hasMoreMessages = true;

      // 构建子查询：从 message_targets 表获取符合条件的 message_id
      const mtSubquery = knex("message_targets as mt")
        .select("mt.message_id")
        .where(function() {
          this.where(function() {
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

      while (hasMoreMessages) {
        // 查询一个批次的消息
        // 构建最终查询
        const query = knex("messages as m")
          .whereIn("m.id", knex.select("message_id").from(unionSubquery))
          .modify(function(queryBuilder) {
            if (lastProcessedId) {
              queryBuilder.andWhereRaw(`m.id > ${lastProcessedId}`);
            }
          })
          .orderBy("m.id", "asc")
          .limit(batchSize)
          .select("m.id");

        const messages: Message[] = await query;

        if (messages.length === 0) {
          hasMoreMessages = false; // 没有更多消息，停止分页
          break;
        }

        try {
          const upsertPromises = messages.map((message) => {
            const messageRef = em.getReference(Message, message.id);
            return em.upsert(UserMessageRead, {
              userId: user.identityId,
              message: messageRef,
              readTime: new Date(),
              status: EntityReadStatus.READ,
            }, { onConflictFields: ["userId", "message"]});
          });

          // 等待所有更新操作完成
          await Promise.all(upsertPromises);

          // 更新分页标记，指向当前批次的最后一条消息 ID
          lastProcessedId = messages[messages.length - 1].id;
        } catch {
          throw new ConnectError("Error processing messages", Code.Internal);
        }
      }
      // await deleteKeys([`${unreadMessageCountPrefixKey}${user.identityId}`]);

      return {};
    },

    async deleteMessages(req, ctx) {
      const { userId, messageIds } = req;

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);

      if (!user) {
        throw new ConnectError(`user ${userId} does not exists.`, Code.InvalidArgument);
      }

      const em = await forkEntityManager();

      const userReadRecords = await em.find(UserMessageRead, {
        userId: user.identityId,
        message: { id: { $in: messageIds.map((id) => Number(id)) } },
      });

      for (const id of messageIds) {
        const record = userReadRecords.find((record) => record.message.id === id);
        if (record) {
          record.isDeleted = true;
          em.persist(record);
        } else {
          const message = await em.findOne(Message, { id: Number(id) });
          if (!message) {
            throw new ConnectError(`message ${id} does not exists`, Code.InvalidArgument);
          }

          const newRecord = new UserMessageRead({
            userId: user.identityId,
            message,
            status: ReadStatus.READ,
            isDeleted: true,
            readTime: new Date(),
          });
          em.persist(newRecord);
        }
      }

      await em.flush();


      // await deleteKeys([`${unreadMessageCountPrefixKey}${user.identityId}`]);

      return {};
    },

    async deleteAllReadMessages(req, ctx) {

      const { userId } = req;

      if (userId) await checkScowApiToken(ctx, commonConfig.scowApi);

      const user = userId ? await getUser(userId, logger) : await checkAuth(ctx);

      if (!user) {
        throw new ConnectError(`user ${userId} does not exists.`, Code.InvalidArgument);
      }

      const em = await forkEntityManager();
      const batchSize = 100; // 每批次处理的消息数量
      let lastProcessedId: bigint | null = null; // 用于分页查询
      let hasMoreMessages = true;

      // 执行分页查询并批量删除
      while (hasMoreMessages) {
        // 查询批次的消息，按照 ID 排序以便分页
        const messages = await em.find(Message, {
          userMessageRead: { userId: user.identityId, status: ReadStatus.READ, isDeleted: false },
          $or: [
            { messageTarget: { targetType: TargetType.FULL_SITE } },
            { messageTarget: { targetType: TargetType.USER, targetId: user.identityId } },
          ],
          ...(lastProcessedId ? { id: { $gt: lastProcessedId } } : {}), // 分页：只查询大于上次处理的 ID
        }, {
          fields: ["id"],
          limit: batchSize,
          orderBy: { id: 1 }, // 按照 ID 排序
        });

        if (messages.length === 0) {
          hasMoreMessages = false; // 没有更多消息，退出循环
          break;
        }

        // 提取消息的 ID
        const messageIds = messages.map((message) => message.id);

        // 执行批量更新，标记这些消息为已删除
        await em.nativeUpdate(UserMessageRead, {
          userId: user.identityId,
          message: { id: { $in: messageIds } },
        }, { isDeleted: true });

        // 更新分页的起始 ID，为下一批次查询做准备
        lastProcessedId = messages[messages.length - 1].id;
      }

      // await deleteKeys([`${unreadMessageCountPrefixKey}${user.identityId}`]);
      return {};
    },

    async changeMessageExpirationTime(req, context) {

      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to modify message config`,
          Code.PermissionDenied,
        );
      }

      const { messageType, expiredAfterSeconds } = req;

      const em = await forkEntityManager();

      if (!messageType) {
        const allConfigs = await em.findAll(AdminMessageConfig);

        for (const config of allConfigs) {
          config.expiredAfterSeconds = expiredAfterSeconds;
        }

        await em.persistAndFlush(allConfigs);
      } else {
        const messageConfig = await em.findOne(AdminMessageConfig, { messageType });

        if (messageConfig) {
          messageConfig.expiredAfterSeconds = expiredAfterSeconds;

          await em.persistAndFlush(messageConfig);
        }
      }

      return {};
    },
    async getMessageExpirationTime(req, context) {

      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(
          `User ${user.identityId} unable to modify message config`,
          Code.PermissionDenied,
        );
      }

      const { messageType } = req;

      const em = await forkEntityManager();

      const messageConfigs = await em.find(AdminMessageConfig, {
        ...messageType ? { messageType } : {},
      }, { limit: 1 });

      if (messageConfigs.length === 0) {
        throw new ConnectError(
          `Message type ${messageType} does not exist`,
          Code.InvalidArgument,
        );
      }

      return {
        expiredAfterSeconds: messageConfigs[0].expiredAfterSeconds,
      };
    },
  });
};
