import { Metadata, status, StatusObject } from "@grpc/grpc-js";
import { Writer } from "protobufjs";
import { Any } from "src/generated/google/protobuf/any";

import { DeepPartial, Status } from "./generated/status";

const headerName = "grpc-status-details-bin";

const typeUrlPrefix = "scow.com/";

export const parseErrorStatus = (metadata: Metadata) => {
  const data = metadata.get(headerName)[0];

  if (!data) {
    return { status: null, findDetails: () => [] };
  }

  const status = Status.decode(Uint8Array.from(Buffer.from(data)));

  return {
    status,
    findDetails: <T>(type: MessageType<T>): T[] => {
      const responses: T[] = [];

      const details = status.details;
      for (const detail of details) {
        if (detail.typeUrl.endsWith(type.$type)) {
          responses.push(type.decode(detail.value));
        }
      }

      return responses;
    },
  };
};

interface MessageType<T> {
  $type: string;
  fromPartial(_: DeepPartial<T>): T;
  encode: (message: T, writer?: Writer) => Writer;
  decode: (input: Uint8Array) => T;
}

export const encodeMessage = <T>(type: MessageType<T>, message: T) => {
  return Any.fromPartial({
    typeUrl: typeUrlPrefix + type.$type,
    value: type.encode(message).finish(),
  });
};

export class DetailedError extends Error implements StatusObject {
  code: status;
  details: string;
  metadata: Metadata;

  constructor(
    error: {
      code: status;
      message: string;
      details: Any[];
    },
    options?: ErrorOptions,
  ) {
    super(error.message, options);
    this.code = error.code;
    this.details = error.message;

    const status = Status.fromPartial({
      code: error.code,
      message: error.message,
      details: error.details,
    });

    this.metadata = new Metadata();
    this.metadata.set(headerName, Buffer.from(Status.encode(status).finish()));
  }
}
