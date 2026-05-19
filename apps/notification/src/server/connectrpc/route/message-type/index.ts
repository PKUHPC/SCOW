import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { MessageTypeService } from "@scow/notification-protos/build/message_type_pb";
import { MessageTypeInfo } from "src/models/message-type";
import { PlatformRole } from "src/models/user";
import { CustomMessageType } from "src/server/entities/CustomMessageType";
import { checkAuth } from "src/utils/auth/check-auth";
import { ensureNotUndefined } from "src/utils/ensure-not-undefined";
import { forkEntityManager } from "src/utils/get-orm";
import { checkMessageTypeExist, findInInternalMessageTypesMap } from "src/utils/message-type";

export default (router: ConnectRouter) => {
  router.service(MessageTypeService, {
    // 数据来源于两个部分，适合做前端分页，数据量也不会太大
    async listMessageTypes(req, context) {
      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(`User ${user.identityId} unable to get message types.`, Code.PermissionDenied);
      }

      const { type, category } = req;

      const messageTypes: MessageTypeInfo[] = [];

      // 获取内置类型
      const internalMessageTypes = findInInternalMessageTypesMap(type, category);
      if (internalMessageTypes) messageTypes.push(...internalMessageTypes);

      // 获取自定义类型
      const em = await forkEntityManager();

      const queryFilters: Record<string, any> = {};
      if (type) queryFilters.type = type;
      if (category) queryFilters.category = category;

      const [customMessageTypes, customTypesCount] = await em.findAndCount(CustomMessageType, queryFilters);

      messageTypes.push(
        ...customMessageTypes.map((customType) => ({
          ...customType,
        })),
      );

      return {
        totalCount: internalMessageTypes
          ? BigInt(customTypesCount + internalMessageTypes.length)
          : BigInt(customTypesCount),
        messageTypes,
      };
    },

    async createCustomMessageType(req, context) {
      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(`User ${user.identityId} unable to create message type.`, Code.PermissionDenied);
      }

      const { type, category } = req;

      const { titleTemplate, contentTemplate, categoryTemplate } = ensureNotUndefined(req, [
        "titleTemplate",
        "contentTemplate",
        "categoryTemplate",
      ]);

      const em = await forkEntityManager();

      // 查看类型是否已存在
      const messageType = await checkMessageTypeExist(em, type);
      if (messageType) {
        throw new ConnectError(`Message type: ${type} already exists.`, Code.AlreadyExists);
      }

      const newMessageType = new CustomMessageType({
        type,
        titleTemplate,
        contentTemplate,
        category,
        categoryTemplate,
      });
      await em.persistAndFlush(newMessageType);

      return {};
    },

    async editCustomMessageType(req, context) {
      const user = await checkAuth(context);

      if (!user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
        throw new ConnectError(`User ${user.identityId} unable to create message type.`, Code.PermissionDenied);
      }

      const { type, category } = req;

      const { titleTemplate, contentTemplate, categoryTemplate } = ensureNotUndefined(req, [
        "titleTemplate",
        "contentTemplate",
        "categoryTemplate",
      ]);

      if (findInInternalMessageTypesMap(type).length !== 0) {
        throw new ConnectError("Built-in message types cannot be modified.", Code.InvalidArgument);
      }

      const em = await forkEntityManager();

      const messageType = await em.findOne(CustomMessageType, { type });

      if (!messageType) {
        throw new ConnectError(`Message type: ${type} doesn't exist`, Code.InvalidArgument);
      }

      messageType.titleTemplate = titleTemplate;
      messageType.contentTemplate = contentTemplate;
      if (category) messageType.category = category;
      messageType.categoryTemplate = categoryTemplate;

      await em.persistAndFlush(messageType);

      return {};
    },
  });
};
