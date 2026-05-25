import { ScalarType, type DescEnum, type DescField, type DescMessage } from "@bufbuild/protobuf";
import { type GenService } from "@bufbuild/protobuf/codegenv2";
import { ApiKeyService } from "@scow/notification-protos/build/api_key_pb";
import { ConfigService } from "@scow/notification-protos/build/config_pb";
import { MessageConfigService } from "@scow/notification-protos/build/message_config_pb";
import { MessageService } from "@scow/notification-protos/build/message_pb";
import { MessageTypeService } from "@scow/notification-protos/build/message_type_pb";
import { NoticeTypeService } from "@scow/notification-protos/build/notice_type_pb";
import { ScowMessageService } from "@scow/notification-protos/build/scow_message_pb";
import { UserService } from "@scow/notification-protos/build/user_pb";
import { UserSubscriptionService } from "@scow/notification-protos/build/user_subscription_pb";

type SchemaObject = Record<string, unknown>;

const services: GenService<any>[] = [
  ApiKeyService,
  MessageConfigService,
  UserSubscriptionService,
  MessageTypeService,
  MessageService,
  NoticeTypeService,
  ConfigService,
  UserService,
  ScowMessageService,
];

const refName = (typeName: string) => typeName.replaceAll(".", "_");

const messageRef = (message: DescMessage) => ({ $ref: `#/components/schemas/${refName(message.typeName)}` });

const enumSchema = (desc: DescEnum): SchemaObject => ({
  type: "string",
  enum: desc.values.map((value) => value.name),
});

const scalarSchema = (scalar: ScalarType): SchemaObject => {
  switch (scalar) {
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return { type: "number" };
    case ScalarType.INT32:
    case ScalarType.UINT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
      return { type: "integer", format: "int32" };
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
    case ScalarType.FIXED64:
      return { type: "integer", format: "int64" };
    case ScalarType.BOOL:
      return { type: "boolean" };
    case ScalarType.BYTES:
      return { type: "string", format: "byte" };
    case ScalarType.STRING:
    default:
      return { type: "string" };
  }
};

const fieldSchema = (field: DescField): SchemaObject => {
  if (field.fieldKind === "list") {
    const items =
      field.listKind === "message"
        ? messageRef(field.message)
        : field.listKind === "enum"
          ? enumSchema(field.enum)
          : scalarSchema(field.scalar);
    return { type: "array", items };
  }

  if (field.fieldKind === "map") {
    const additionalProperties =
      field.mapKind === "message"
        ? messageRef(field.message)
        : field.mapKind === "enum"
          ? enumSchema(field.enum)
          : scalarSchema(field.scalar);
    return { type: "object", additionalProperties };
  }

  if (field.fieldKind === "message") return messageRef(field.message);
  if (field.fieldKind === "enum") return enumSchema(field.enum);
  return scalarSchema(field.scalar);
};

const collectMessageSchemas = (message: DescMessage, schemas: Record<string, SchemaObject>) => {
  const name = refName(message.typeName);
  if (schemas[name]) return;

  schemas[name] = {
    type: "object",
    properties: Object.fromEntries(message.fields.map((field) => [field.jsonName, fieldSchema(field)])),
  };

  for (const nestedMessage of message.nestedMessages) collectMessageSchemas(nestedMessage, schemas);
  for (const field of message.fields) {
    if (field.fieldKind === "message") collectMessageSchemas(field.message, schemas);
    if (field.fieldKind === "list" && field.listKind === "message") collectMessageSchemas(field.message, schemas);
    if (field.fieldKind === "map" && field.mapKind === "message") collectMessageSchemas(field.message, schemas);
  }
};

const paths = Object.fromEntries(
  services.flatMap((service) =>
    service.methods.map((method) => [
      `/api/${service.typeName}/${method.name}`,
      {
        post: {
          tags: [service.name],
          summary: `${service.name}.${method.name}`,
          operationId: `${service.name}_${method.localName}`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: messageRef(method.input),
              },
            },
          },
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: messageRef(method.output),
                },
              },
            },
          },
        },
      },
    ]),
  ),
);

const schemas: Record<string, SchemaObject> = {};

for (const service of services) {
  for (const method of service.methods) {
    collectMessageSchemas(method.input, schemas);
    collectMessageSchemas(method.output, schemas);
  }
}

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SCOW Notification API",
    description: "Connect RPC API for SCOW Notification",
    version: "1.0.0",
  },
  paths,
  components: {
    schemas,
  },
};
