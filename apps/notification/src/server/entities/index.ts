import { AdminMessageConfigSchema } from "src/server/entities/AdminMessageConfig";
import { ApiKeySchema } from "src/server/entities/ApiKey";
import { CustomMessageTypeSchema } from "src/server/entities/CustomMessageType";
import { MessageSchema } from "src/server/entities/Message";
import { MessageTargetSchema } from "src/server/entities/MessageTarget";
import { UserMessageReadSchema } from "src/server/entities/UserMessageRead";
import { UserSubscriptionSchema } from "src/server/entities/UserSubscription";

export const entities = [
  MessageSchema,
  AdminMessageConfigSchema,
  ApiKeySchema,
  MessageTargetSchema,
  CustomMessageTypeSchema,
  UserMessageReadSchema,
  UserSubscriptionSchema,
];
