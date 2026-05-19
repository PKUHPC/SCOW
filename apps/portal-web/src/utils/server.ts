import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { IncomingMessage } from "http";
import { NextApiRequest } from "next";

type ValueOf<T> = T[keyof T];

export const handlegRPCError =
  <THandlers extends Partial<Record<Status, (e: ServiceError) => unknown>>>(
    handlers: THandlers,
    logHandle?: () => void,
  ) =>
  // @ts-ignore
  (e: ServiceError): ReturnType<ValueOf<THandlers>> => {
    logHandle?.();
    const handler = handlers[e.code];
    if (handler) {
      // @ts-ignore
      return handler(e) as ReturnType<ValueOf<THandlers>>;
    } else {
      throw e;
    }
  };

export const parseIp = (req: NextApiRequest | IncomingMessage): string | undefined => {
  let forwardedFor = req.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor)) {
    forwardedFor = forwardedFor.shift();
  }

  if (typeof forwardedFor === "string") {
    forwardedFor = forwardedFor.split(",").shift();
  }

  return forwardedFor ?? req.socket?.remoteAddress;
};
