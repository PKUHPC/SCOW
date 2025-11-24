import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { UserSubscriptionService } from "@scow/notification-protos/build/user_subscription_pb";
import { UserSubscription } from "src/server/entities/UserSubscription";
import { checkAuth } from "src/utils/auth/check-auth";
import { forkEntityManager } from "src/utils/get-orm";
import { checkNoticeTypeEnabled } from "src/utils/message/check-message";
import { getMessageConfigsWithDefault, getMessageConfigWithDefault } from "src/utils/message-config";
import { checkMessageTypeExist } from "src/utils/message-type";

export default (router: ConnectRouter) => {
  router.service(UserSubscriptionService, {
    async modifyUserSubscription(req, context) {

      const user = await checkAuth(context);

      const { configs } = req;

      const em = await forkEntityManager();

      for (const config of configs) {
        const { messageType, noticeConfigs } = config;
        // 查看是否有这消息类型
        const messageTypeData = await checkMessageTypeExist(em, messageType);
        if (!messageTypeData) {
          throw new ConnectError(
            `Message type ${messageType} does't exists.`,
            Code.InvalidArgument,
          );
        }

        for (const noticeConfig of noticeConfigs) {

          const { noticeType, enabled } = noticeConfig;

          // noticeType 不能为 undefined
          if (noticeType === undefined) {
            throw new ConnectError(
              "noticeType cannot be undefined",
              Code.InvalidArgument,
            );
          }

          // 查看通知方式是否开启
          if (!checkNoticeTypeEnabled(noticeType)) {
            throw new ConnectError(
              "This notification type is not enabled",
              Code.InvalidArgument,
            );
          }

          // 查看平台相关配置
          const adminMessageConfig = await getMessageConfigWithDefault(em, messageType, noticeType);

          // 对应消息类型的通知方式没开启或不允许用户修改时，不能更改
          if (adminMessageConfig.enabled !== true || adminMessageConfig.canUserModify === false) {
            continue;
          }

          // 创建 UserSubscription
          const createUserSubscription = () => {
            const newSubConfig = new UserSubscription({
              userId: user.identityId,
              noticeType,
              messageType,
              isSubscribed: enabled ?? false,
            });
            em.persist(newSubConfig);
          };

          const userSubConfig = await em.findOne(UserSubscription,
            { userId: user.identityId, messageType, noticeType });

          if (userSubConfig) {
            userSubConfig.isSubscribed = enabled ?? userSubConfig.isSubscribed;
            em.persist(userSubConfig);
          } else {
            createUserSubscription();
          }
        }
      }

      await em.flush();

      return {};
    },

    async listUserSubscriptions(_, context) {

      const user = await checkAuth(context);

      const em = await forkEntityManager();

      // 前端分页
      const userSubscriptions = await em.find(UserSubscription, { userId: user.identityId });

      const { mergedResults: adminConfigs, totalCount } = await getMessageConfigsWithDefault(em);

      const finalResult = adminConfigs.map((config) => {
        const noticeConfigs = config.noticeConfigs.map((noticeConfig) => {
          const common = userSubscriptions.find((sub) =>
            sub.messageType === config.messageType && sub.noticeType === noticeConfig.noticeType,
          );
          return noticeConfig.enabled
            ? noticeConfig.canUserModify && common ? { ...noticeConfig, enabled: common.isSubscribed } : noticeConfig
            : { ...noticeConfig, canUserModify: false };
        });

        return {
          ...config,
          noticeConfigs,
        };
      });

      return {
        totalCount: totalCount,
        configs: finalResult.map((sub) => ({
          ...sub,
        })),
      };
    },
  });
};
